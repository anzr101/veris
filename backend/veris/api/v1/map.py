"""Map of Science endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from veris.api.deps import get_services
from veris.api.state import Services
from veris.buildmap import router_from
from veris.insights.map_builder import build_map, load_map, save_map

router = APIRouter()


@router.get("/map")
async def get_map(services: Services = Depends(get_services)) -> dict[str, Any]:
    """Serve the map artifact, building it lazily if absent.

    The artifact is a file, and container filesystems are ephemeral — after a
    restart the file is gone even though the corpus survives in Postgres, so
    the first request after boot rebuilds it (one-time ~15s + a few utility-
    model label calls) and every later request reads the file.
    """
    artifact = load_map()
    # Rebuild when absent, and also when a previously saved artifact is empty but the
    # corpus isn't — that happens when the map was built mid-seeding (papers ingested,
    # chunks not embedded yet) and would otherwise be served stale forever.
    stale_empty = artifact is not None and artifact.n_papers == 0
    if (artifact is None or stale_empty) and await services.store.count_papers() > 0:
        rebuilt = await build_map(
            services.store,
            router_from(services),
            embedding_model=services.settings.embedding_model,
        )
        if rebuilt.n_papers > 0 or artifact is None:
            save_map(rebuilt)
            artifact = rebuilt
    if artifact is None:
        return {
            "built_at": None,
            "n_papers": 0,
            "nodes": [],
            "clusters": [],
            "edges": [],
            "note": "No corpus yet. Ingest papers first (POST /v1/ingest).",
        }
    return artifact.model_dump()


@router.post("/map/build")
async def build(services: Services = Depends(get_services)) -> dict[str, int]:
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
