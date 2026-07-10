"""Map of Science endpoints."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends

from veris.api.deps import get_services
from veris.api.state import Services
from veris.buildmap import router_from
from veris.core.logging import get_logger
from veris.insights.map_builder import build_map, load_map, save_map

_log = get_logger("veris.map.api")

router = APIRouter()

# One build at a time per process; requests never block on it.
_build_lock = asyncio.Lock()


async def rebuild_map_background(services: Services) -> None:
    """Build and persist the map artifact; no-op if a build is already running."""
    if _build_lock.locked():
        return
    async with _build_lock:
        try:
            artifact = await build_map(
                services.store,
                router_from(services),
                embedding_model=services.settings.embedding_model,
            )
            if artifact.n_papers > 0:
                save_map(artifact)
            _log.info("map.rebuilt", n_papers=artifact.n_papers)
        except Exception:
            _log.exception("map.rebuild_failed")


@router.get("/map")
async def get_map(services: Services = Depends(get_services)) -> dict[str, Any]:
    """Serve the map artifact; if it's missing or stale-empty, rebuild in the background.

    The artifact is a file, and container filesystems are ephemeral — after a restart
    the file is gone even though the corpus is bundled/persisted. Building takes real
    CPU time (projection + clustering), so the request never blocks on it: it kicks a
    background build and tells the client to check back.
    """
    artifact = load_map()
    if artifact is not None and artifact.n_papers > 0:
        return artifact.model_dump()

    if await services.store.count_papers() > 0:
        asyncio.get_running_loop().create_task(rebuild_map_background(services))
        return {
            "built_at": None,
            "n_papers": 0,
            "nodes": [],
            "clusters": [],
            "edges": [],
            "note": "Map is being built from the corpus — refresh in a moment.",
        }
    return {
        "built_at": None,
        "n_papers": 0,
        "nodes": [],
        "clusters": [],
        "edges": [],
        "note": "No corpus yet. Ingest papers first (POST /v1/ingest).",
    }


@router.post("/map/build")
async def build(services: Services = Depends(get_services)) -> dict[str, int]:
    """Rebuild the map from the current corpus and persist it (blocking)."""
    artifact = await build_map(
        services.store, router_from(services), embedding_model=services.settings.embedding_model
    )
    save_map(artifact)
    return {
        "n_papers": artifact.n_papers,
        "clusters": len(artifact.clusters),
        "edges": len(artifact.edges),
    }
