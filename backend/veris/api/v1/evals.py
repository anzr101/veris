"""Eval dashboard endpoint — serves the latest faithfulness report."""

from __future__ import annotations

import json

from fastapi import APIRouter

from veris.evals.harness import RESULTS_PATH

router = APIRouter()


@router.get("/evals")
async def latest_evals() -> dict:
    """Return the most recent eval report, or an empty placeholder if none has run."""
    if RESULTS_PATH.exists():
        return json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
    return {
        "benchmark": "veris-core-bench",
        "generated_at": None,
        "aggregate": {},
        "questions": [],
        "note": "No eval run yet. Run `python -m veris.evals.harness`.",
    }
