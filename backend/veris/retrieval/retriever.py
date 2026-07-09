"""Hybrid retriever: dense (pgvector/NumPy) + sparse (FTS/BM25) fused with RRF, reranked."""

from __future__ import annotations

from veris.config import Settings
from veris.domain.models import RetrievalFilters, ScoredChunk
from veris.embeddings.base import Embedder
from veris.retrieval.fusion import reciprocal_rank_fusion
from veris.retrieval.rerank import NoOpReranker, Reranker
from veris.storage.base import Store


class HybridRetriever:
    def __init__(
        self,
        store: Store,
        embedder: Embedder,
        settings: Settings,
        reranker: Reranker | None = None,
    ) -> None:
        self._store = store
        self._embedder = embedder
        self._settings = settings
        self._reranker = reranker or NoOpReranker()

    async def retrieve(
        self,
        query: str,
        *,
        filters: RetrievalFilters | None = None,
        top_k: int | None = None,
    ) -> list[ScoredChunk]:
        s = self._settings
        top_k = top_k or s.rerank_top_k

        query_vec = self._embedder.embed_query(query)
        dense = await self._store.dense_search(query_vec, s.dense_top_k, filters)
        sparse = await self._store.sparse_search(query, s.sparse_top_k, filters)

        fused = reciprocal_rank_fusion([dense, sparse], k=s.rrf_k)
        return self._reranker.rerank(query, fused, top_k=top_k)

    async def retrieve_multi(
        self,
        queries: list[str],
        *,
        filters: RetrievalFilters | None = None,
        top_k: int | None = None,
    ) -> list[ScoredChunk]:
        """Retrieve for several sub-queries and fuse the per-query results with RRF."""
        top_k = top_k or self._settings.rerank_top_k
        per_query: list[list[ScoredChunk]] = []
        for q in queries:
            per_query.append(
                await self.retrieve(q, filters=filters, top_k=self._settings.dense_top_k)
            )
        fused = reciprocal_rank_fusion(per_query, k=self._settings.rrf_k)
        return self._reranker.rerank(" ".join(queries), fused, top_k=top_k)
