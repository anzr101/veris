"""Domain models for a grounded answer: plan, citations, verified claims, contradictions."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class QueryPlan(BaseModel):
    """Decomposition of a research question into retrieval sub-queries + filters."""

    sub_queries: list[str]
    categories: list[str] | None = None
    published_after: datetime | None = None
    intent: Literal["lookup", "synthesis", "comparison"] = "synthesis"


class Citation(BaseModel):
    """A numbered source the answer can reference with ``[n]``."""

    index: int
    chunk_id: int
    arxiv_id: str
    paper_title: str
    section: str
    snippet: str
    url: str


class ClaimVerification(BaseModel):
    """One atomic claim from the answer, checked against its cited evidence."""

    claim: str
    citation_indices: list[int] = Field(default_factory=list)
    status: Literal["supported", "partial", "unsupported"] = "supported"
    confidence: float = 0.0
    rationale: str = ""


class Contradiction(BaseModel):
    """A point where retrieved sources disagree."""

    topic: str
    summary: str
    arxiv_ids: list[str] = Field(default_factory=list)


class Answer(BaseModel):
    """The full grounded response returned to the client."""

    question: str
    markdown: str
    citations: list[Citation] = Field(default_factory=list)
    claims: list[ClaimVerification] = Field(default_factory=list)
    contradictions: list[Contradiction] = Field(default_factory=list)
    plan: QueryPlan | None = None
    model: str = ""
    cost_usd: float = 0.0
    latency_ms: float = 0.0

    @property
    def faithfulness(self) -> float:
        """Fraction of claims that are fully supported (0..1). 1.0 when no claims."""
        if not self.claims:
            return 1.0
        supported = sum(1 for c in self.claims if c.status == "supported")
        return supported / len(self.claims)
