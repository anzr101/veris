"""Storage port.

Both the SQLite (dev) and Postgres (prod) adapters implement this interface. Application
services depend only on ``Store`` — never on a concrete backend.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from veris.domain.insights import PaperVector
from veris.domain.models import ChunkInput, Paper, RetrievalFilters, ScoredChunk


@runtime_checkable
class Store(Protocol):
    async def initialize(self) -> None:
        """Open connections and ensure schema exists."""
        ...

    async def close(self) -> None:
        """Release connections."""
        ...

    async def upsert_paper(self, paper: Paper) -> int:
        """Insert or update a paper by ``arxiv_id``; return its primary key."""
        ...

    async def get_paper_by_arxiv_id(self, arxiv_id: str) -> Paper | None: ...

    async def list_papers(self, *, limit: int = 50, offset: int = 0) -> list[Paper]:
        """Most-recent papers first."""
        ...

    async def replace_chunks(self, paper_id: int, chunks: list[ChunkInput], *, model: str) -> int:
        """Replace all chunks for a paper (idempotent re-ingest). Return count written."""
        ...

    async def dense_search(
        self,
        query_vec: list[float],
        top_k: int,
        filters: RetrievalFilters | None = None,
    ) -> list[ScoredChunk]:
        """Cosine kNN over chunk embeddings."""
        ...

    async def sparse_search(
        self,
        query_text: str,
        top_k: int,
        filters: RetrievalFilters | None = None,
    ) -> list[ScoredChunk]:
        """Full-text (BM25) search over chunk text."""
        ...

    async def count_papers(self) -> int: ...

    async def count_chunks(self) -> int: ...

    async def fetch_all_paper_vectors(self) -> list[PaperVector]:
        """One mean-pooled, L2-normalized vector per paper (for the Map of Science)."""
        ...
