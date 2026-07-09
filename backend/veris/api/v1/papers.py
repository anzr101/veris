"""Corpus endpoints: stats, list papers, fetch one, trigger ingestion."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from veris.api.deps import get_services
from veris.api.schemas import IngestRequest, StatsResponse
from veris.api.state import Services
from veris.domain.models import Paper
from veris.ingestion.service import DEFAULT_CATEGORIES

router = APIRouter()


@router.get("/stats", response_model=StatsResponse)
async def stats(services: Services = Depends(get_services)) -> StatsResponse:
    return StatsResponse(
        papers=await services.store.count_papers(),
        chunks=await services.store.count_chunks(),
        embedding_model=services.embedder.name,
        synthesis_model=services.settings.effective_synthesis_model,
        utility_model=services.settings.effective_utility_model,
    )


@router.get("/papers", response_model=list[Paper])
async def list_papers(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    services: Services = Depends(get_services),
) -> list[Paper]:
    return await services.store.list_papers(limit=limit, offset=offset)


@router.get("/papers/{arxiv_id}", response_model=Paper)
async def get_paper(arxiv_id: str, services: Services = Depends(get_services)) -> Paper:
    paper = await services.store.get_paper_by_arxiv_id(arxiv_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


@router.post("/ingest")
async def ingest(
    req: IngestRequest, services: Services = Depends(get_services)
) -> dict[str, int]:
    categories = tuple(req.categories) if req.categories else DEFAULT_CATEGORIES
    stats = await services.ingestion.ingest(
        req.terms, categories=categories, max_results=req.max_results
    )
    return {"papers": stats.papers, "chunks": stats.chunks}
