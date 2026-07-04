"""Map of Science endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from veris.api.deps import get_services
from veris.api.state import Services
from veris.buildmap import router_from
from veris.insights.map_builder import build_map, load_map, save_map

router = APIRouter()


@router.get("/map")
async def get_map() -> dict:
    """Serve the precomputed map artifact (or a placeholder if none built yet)."""
    artifact = load_map()
    if artifact is None:
        return {
            "built_at": None,
            "n_papers": 0,
            "nodes": [],
            "clusters": [],
            "edges": [],
            "note": "No map yet. Run `python -m veris.buildmap` after ingesting a corpus.",
        }
    return artifact.model_dump()


@router.post("/map/build")
async def build(services: Services = Depends(get_services)) -> dict:
    """Rebuild the map from the current corpus and persist it."""
    artifact = await build_map(
        services.store, router_from(services), embedding_model=services.settings.embedding_model
    )
    save_map(artifact)
    return {
        "n_papers": artifact.n_papers,
        "clusters": len(artifact.clusters),
        "edges": len(artifact.edges),
    }
