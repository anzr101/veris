"""The ask pipeline as a LangGraph state machine.

    START → plan → retrieve → synthesize →(has evidence?)→ verify → END
                                          └────────(no)──────────→ END

Each node wraps one existing service (planner / retriever / synthesizer / grounder), so
the graph is pure orchestration: it owns sequencing, the conditional verify edge, and
event emission — not prompts or parsing. Nodes publish UI events through LangGraph's
custom stream writer, so the same compiled graph serves both the SSE endpoint
(``astream(stream_mode="custom")``) and the synchronous path (``ainvoke``, where the
writer is a no-op). Nodes are ``@traceable``: with ``LANGSMITH_TRACING=true`` and an
API key in the environment every stage lands in LangSmith with timings; without them
the decorator is inert.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any, TypedDict, TypeVar

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langsmith import traceable

from veris.core.logging import get_logger
from veris.domain.answer import Citation, ClaimVerification, Contradiction, QueryPlan
from veris.domain.models import RetrievalFilters, ScoredChunk
from veris.grounding.verifier import Grounder
from veris.guardrails.output_guard import grounded_share, strip_unbacked_citations
from veris.llm.errors import LLMUnavailableError
from veris.llm.router import LLMRouter
from veris.retrieval.retriever import HybridRetriever
from veris.synthesis.planner import QueryPlanner
from veris.synthesis.synthesizer import Synthesizer, build_citations

_log = get_logger("veris.pipeline")

# Provider tokens-per-minute quotas recover within a minute; one spaced retry is
# usually enough to clear them.
_VERIFY_RETRY_DELAY_S = 20


_T = TypeVar("_T")


async def _with_retry(fn: Callable[..., Awaitable[_T]], /, *args: Any) -> _T:
    try:
        return await fn(*args)
    except LLMUnavailableError:
        await asyncio.sleep(_VERIFY_RETRY_DELAY_S)
        return await fn(*args)


class AskGraphState(TypedDict, total=False):
    question: str
    verify: bool  # skip the verification stage when False (e.g. quick evals)
    plan: QueryPlan
    chunks: list[ScoredChunk]
    citations: list[Citation]
    markdown: str
    claims: list[ClaimVerification]
    contradictions: list[Contradiction]
    faithfulness: float


def build_ask_graph(
    router: LLMRouter, retriever: HybridRetriever
) -> CompiledStateGraph[AskGraphState, None, AskGraphState, AskGraphState]:
    """Compile the ask graph around a per-request router (its tracer scopes cost/latency)."""
    planner = QueryPlanner(router)
    synthesizer = Synthesizer(router)
    grounder = Grounder(router)

    @traceable(name="plan", run_type="chain")
    async def plan_node(state: AskGraphState) -> AskGraphState:
        # Planning is an optimization; if the utility model is briefly unavailable,
        # retrieval on the raw question still yields a grounded answer.
        try:
            plan = await planner.plan(state["question"])
        except LLMUnavailableError as e:
            _log.warning("plan.fallback_raw_question", detail=e.detail)
            plan = QueryPlan(sub_queries=[state["question"]], intent="synthesis")
        get_stream_writer()({"type": "plan", "data": plan.model_dump(mode="json")})
        return {"plan": plan}

    @traceable(name="retrieve", run_type="retriever")
    async def retrieve_node(state: AskGraphState) -> AskGraphState:
        plan = state["plan"]
        filters = RetrievalFilters(
            categories=plan.categories, published_after=plan.published_after
        )
        chunks = await retriever.retrieve_multi(plan.sub_queries, filters=filters)
        citations = build_citations(chunks)
        get_stream_writer()(
            {"type": "citations", "data": [c.model_dump() for c in citations]}
        )
        return {"chunks": chunks, "citations": citations}

    @traceable(name="synthesize", run_type="llm")
    async def synthesize_node(state: AskGraphState) -> AskGraphState:
        writer = get_stream_writer()
        parts: list[str] = []
        async for delta in synthesizer.stream(state["question"], state["chunks"]):
            parts.append(delta)
            writer({"type": "token", "data": delta})
        # Output guardrail: drop citation markers pointing at evidence that doesn't exist.
        markdown = strip_unbacked_citations("".join(parts), len(state["citations"]))
        return {"markdown": markdown}

    @traceable(name="verify", run_type="chain")
    async def verify_node(state: AskGraphState) -> AskGraphState:
        # Verification enriches an answer that already exists — a provider outage here
        # (typically a free-tier rate limit) must never destroy the streamed answer.
        # Retry once after the quota window; if it still fails, skip verification.
        writer = get_stream_writer()
        try:
            claims = await _with_retry(grounder.verify, state["markdown"], state["chunks"])
        except LLMUnavailableError as e:
            _log.warning("verify.skipped", detail=e.detail)
            return {}
        faithfulness = grounded_share(claims)
        writer(
            {
                "type": "verification",
                "data": {
                    "claims": [c.model_dump() for c in claims],
                    "faithfulness": faithfulness,
                },
            }
        )
        try:
            contradictions = await _with_retry(grounder.find_contradictions, state["chunks"])
        except LLMUnavailableError as e:
            _log.warning("contradictions.skipped", detail=e.detail)
            contradictions = []
        writer(
            {"type": "contradictions", "data": [c.model_dump() for c in contradictions]}
        )
        return {
            "claims": claims,
            "contradictions": contradictions,
            "faithfulness": faithfulness,
        }

    def should_verify(state: AskGraphState) -> str:
        # Nothing retrieved → nothing to verify against; and callers may opt out.
        if state.get("verify", True) and state.get("chunks"):
            return "verify"
        return END

    graph = StateGraph(AskGraphState)
    graph.add_node("plan", plan_node)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("verify", verify_node)
    graph.add_edge(START, "plan")
    graph.add_edge("plan", "retrieve")
    graph.add_edge("retrieve", "synthesize")
    graph.add_conditional_edges("synthesize", should_verify, {"verify": "verify", END: END})
    graph.add_edge("verify", END)
    return graph.compile()
