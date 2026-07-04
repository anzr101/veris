"""Versioned API router aggregation."""

from __future__ import annotations

from fastapi import APIRouter

from veris.api.v1 import ask, evals, map, papers, position

router = APIRouter()
router.include_router(papers.router, tags=["corpus"])
router.include_router(ask.router, tags=["ask"])
router.include_router(map.router, tags=["map"])
router.include_router(position.router, tags=["position"])
router.include_router(evals.router, tags=["evals"])
