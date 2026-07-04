"""AskService — the end-to-end grounded-answer pipeline.

plan (Haiku) → hybrid retrieve (RRF) → synthesize (Opus, streaming) → verify claims +
detect contradictions (Haiku). Exposes a full ``ask()`` and a streaming ``ask_stream()``
that emits typed events for the SSE endpoint. Each call gets a fresh tracer so cost and
latency are per-request, not per-process.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from typing import Any

from veris.config import Settings
from veris.domain.answer import Answer
from veris.domain.models import RetrievalFilters
from veris.grounding.verifier import Grounder
from veris.llm.base import LLMProvider
from veris.llm.router import LLMRouter
from veris.llm.tracing import Tracer
from veris.retrieval.retriever import HybridRetriever
from veris.synthesis.planner import QueryPlanner
from veris.synthesis.synthesizer import Synthesizer, build_citations


class AskService:
    def __init__(
        self,
        provider: LLMProvider,
        retriever: HybridRetriever,
        settings: Settings,
    ) -> None:
        self._provider = provider
        self._retriever = retriever
        self._settings = settings

    def _router(self, tracer: Tracer) -> LLMRouter:
        return LLMRouter(
            self._provider,
            synthesis_model=self._settings.synthesis_model,
            utility_model=self._settings.utility_model,
            tracer=tracer,
        )

    async def ask(self, question: str, *, verify: bool = True) -> Answer:
        start = time.perf_counter()
        tracer = Tracer()
        router = self._router(tracer)
        planner, synth, grounder = QueryPlanner(router), Synthesizer(router), Grounder(router)

        plan = await planner.plan(question)
        filters = RetrievalFilters(categories=plan.categories, published_after=plan.published_after)
        chunks = await self._retriever.retrieve_multi(plan.sub_queries, filters=filters)
        citations = build_citations(chunks)

        synth_result = await synth.synthesize(question, chunks)

        claims = await grounder.verify(synth_result.text, chunks) if verify and chunks else []
        contradictions = (
            await grounder.find_contradictions(chunks) if verify and chunks else []
        )

        return Answer(
            question=question,
            markdown=synth_result.text,
            citations=citations,
            claims=claims,
            contradictions=contradictions,
            plan=plan,
            model=synth_result.model,
            cost_usd=tracer.total_cost_usd,
            latency_ms=(time.perf_counter() - start) * 1000,
        )

    async def ask_stream(self, question: str) -> AsyncIterator[dict[str, Any]]:
        """Yield typed events: plan → citations → token* → verification → contradictions → done."""
        start = time.perf_counter()
        tracer = Tracer()
        router = self._router(tracer)
        planner, synth, grounder = QueryPlanner(router), Synthesizer(router), Grounder(router)

        plan = await planner.plan(question)
        yield {"type": "plan", "data": plan.model_dump(mode="json")}

        filters = RetrievalFilters(categories=plan.categories, published_after=plan.published_after)
        chunks = await self._retriever.retrieve_multi(plan.sub_queries, filters=filters)
        citations = build_citations(chunks)
        yield {"type": "citations", "data": [c.model_dump() for c in citations]}

        parts: list[str] = []
        async for delta in synth.stream(question, chunks):
            parts.append(delta)
            yield {"type": "token", "data": delta}
        markdown = "".join(parts)

        if chunks:
            claims = await grounder.verify(markdown, chunks)
            yield {
                "type": "verification",
                "data": {
                    "claims": [c.model_dump() for c in claims],
                    "faithfulness": _faithfulness(claims),
                },
            }
            contradictions = await grounder.find_contradictions(chunks)
            yield {
                "type": "contradictions",
                "data": [c.model_dump() for c in contradictions],
            }

        yield {
            "type": "done",
            "data": {
                "model": self._settings.synthesis_model,
                "cost_usd": round(tracer.total_cost_usd, 6),
                "latency_ms": round((time.perf_counter() - start) * 1000, 1),
            },
        }


def _faithfulness(claims: list) -> float:
    if not claims:
        return 1.0
    return sum(1 for c in claims if c.status == "supported") / len(claims)
