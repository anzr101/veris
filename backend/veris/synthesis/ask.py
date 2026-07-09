"""AskService — the end-to-end grounded-answer pipeline.

Orchestration lives in the LangGraph state machine (``veris.pipeline.graph``):
plan → hybrid retrieve (RRF) → synthesize (streaming) → verify claims + detect
contradictions. This service is the thin application-facing wrapper: it builds a
per-request router (fresh tracer, so cost and latency are per-request), compiles the
graph around it, and exposes a full ``ask()`` plus a streaming ``ask_stream()`` that
relays the graph's custom-stream events to the SSE endpoint.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from typing import Any

from veris.config import Settings
from veris.domain.answer import Answer
from veris.llm.base import LLMProvider
from veris.llm.router import LLMRouter
from veris.llm.tracing import Tracer
from veris.pipeline.graph import build_ask_graph
from veris.retrieval.retriever import HybridRetriever


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
            synthesis_model=self._settings.effective_synthesis_model,
            utility_model=self._settings.effective_utility_model,
            tracer=tracer,
        )

    async def ask(self, question: str, *, verify: bool = True) -> Answer:
        start = time.perf_counter()
        tracer = Tracer()
        graph = build_ask_graph(self._router(tracer), self._retriever)

        state = await graph.ainvoke({"question": question, "verify": verify})

        return Answer(
            question=question,
            markdown=state.get("markdown", ""),
            citations=state.get("citations", []),
            claims=state.get("claims", []),
            contradictions=state.get("contradictions", []),
            plan=state["plan"],
            model=self._settings.effective_synthesis_model,
            cost_usd=tracer.total_cost_usd,
            latency_ms=(time.perf_counter() - start) * 1000,
        )

    async def ask_stream(self, question: str) -> AsyncIterator[dict[str, Any]]:
        """Yield typed events: plan → citations → token* → verification → contradictions → done."""
        start = time.perf_counter()
        tracer = Tracer()
        graph = build_ask_graph(self._router(tracer), self._retriever)

        # Nodes publish UI events through LangGraph's custom stream writer; relay them.
        async for event in graph.astream(
            {"question": question, "verify": True}, stream_mode="custom"
        ):
            yield event

        yield {
            "type": "done",
            "data": {
                "model": self._settings.effective_synthesis_model,
                "cost_usd": round(tracer.total_cost_usd, 6),
                "latency_ms": round((time.perf_counter() - start) * 1000, 1),
            },
        }
