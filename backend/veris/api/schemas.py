"""Request/response schemas for the API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)


class IngestRequest(BaseModel):
    terms: str | None = None
    categories: list[str] | None = None
    max_results: int = Field(default=25, ge=1, le=100)


class StatsResponse(BaseModel):
    papers: int
    chunks: int
    embedding_model: str
    synthesis_model: str
    utility_model: str
