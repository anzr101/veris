"""Core domain models shared across ingestion, retrieval, synthesis, and grounding.

These are transport-agnostic Pydantic models. Storage adapters map them to/from rows;
the API maps them to/from JSON. Nothing here depends on a database or vendor.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Paper(BaseModel):
    """A research paper as ingested from a source (currently arXiv)."""

    arxiv_id: str
    title: str
    abstract: str
    authors: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    published_at: datetime | None = None
    updated_at: datetime | None = None
    pdf_url: str | None = None
    raw_meta: dict = Field(default_factory=dict)


class Chunk(BaseModel):
    """A retrievable passage of a paper."""

    paper_id: int
    ordinal: int
    section: str
    text: str
    token_count: int


class ChunkInput(BaseModel):
    """A chunk plus its embedding, ready to be persisted."""

    ordinal: int
    section: str
    text: str
    token_count: int
    embedding: list[float]


class ScoredChunk(BaseModel):
    """A retrieved chunk carrying enough paper metadata to cite it.

    ``score`` is method-relative (cosine similarity for dense, normalized BM25 for sparse,
    fused RRF score after fusion). ``rank`` is the 1-based position within its result list.
    """

    chunk_id: int
    paper_id: int
    arxiv_id: str
    paper_title: str
    ordinal: int
    section: str
    text: str
    score: float
    rank: int = 0


class RetrievalFilters(BaseModel):
    """Optional constraints applied during retrieval."""

    categories: list[str] | None = None
    published_after: datetime | None = None

    @property
    def is_empty(self) -> bool:
        return not self.categories and self.published_after is None
