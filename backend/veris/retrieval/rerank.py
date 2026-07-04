"""Reranker port + a no-op default.

A cross-encoder reranker (e.g. fastembed's reranker models) measurably improves final
ordering, but it's a heavyweight optional dependency. The pipeline depends only on the
``Reranker`` protocol; the no-op keeps everything runnable, and a real reranker can be
dropped in via the factory without touching the retriever.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from veris.domain.models import ScoredChunk


@runtime_checkable
class Reranker(Protocol):
    def rerank(self, query: str, chunks: list[ScoredChunk], *, top_k: int) -> list[ScoredChunk]:
        ...


class NoOpReranker:
    """Passthrough: preserve fusion order, truncate to ``top_k``."""

    def rerank(
        self, query: str, chunks: list[ScoredChunk], *, top_k: int
    ) -> list[ScoredChunk]:
        return [c.model_copy(update={"rank": i}) for i, c in enumerate(chunks[:top_k], 1)]
