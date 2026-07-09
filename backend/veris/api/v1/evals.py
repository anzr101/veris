"""Eval dashboard endpoints — serve the latest faithfulness report, or regenerate it.

The report is a file on an ephemeral filesystem, so it disappears on every container
restart. ``POST /evals/run`` lets the deployment regenerate it in place against the live
corpus and LLM provider — tightly rate-limited because a run is ~20 LLM calls.
"""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request

from veris.api.deps import get_services
from veris.api.security import limiter
from veris.api.state import Services
from veris.core.logging import get_logger
from veris.evals.harness import RESULTS_PATH, load_benchmark
from veris.evals.metrics import aggregate, score_answer

_log = get_logger("veris.evals.api")

router = APIRouter()

_run_lock = asyncio.Lock()


@router.get("/evals")
async def latest_evals() -> dict[str, Any]:
    """Return the most recent eval report, or an empty placeholder if none has run."""
    if RESULTS_PATH.exists():
        report: dict[str, Any] = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
        return report
    return {
        "benchmark": "veris-core-bench",
        "generated_at": None,
        "aggregate": {},
        "questions": [],
        "note": "No eval run yet. POST /v1/evals/run (or `python -m veris.evals.harness`).",
    }


@router.post("/evals/run", status_code=202)
@limiter.limit("1/hour")
async def run_evals(
    request: Request, services: Services = Depends(get_services)
) -> dict[str, str]:
    """Kick off a benchmark run against the live corpus; the dashboard picks it up."""
    if _run_lock.locked():
        return {"status": "already-running"}
    asyncio.get_running_loop().create_task(_run_benchmark(services))
    return {"status": "started", "questions": str(len(load_benchmark()["questions"]))}


async def _run_benchmark(services: Services) -> None:
    async with _run_lock:
        bench = load_benchmark()
        per_question: list[dict[str, Any]] = []
        try:
            for question in bench["questions"]:
                answer = await services.ask.ask(question)
                per_question.append({"question": question, "scores": score_answer(answer)})
            report = {
                "benchmark": bench["name"],
                "generated_at": datetime.now(UTC).isoformat(),
                "model": services.settings.effective_synthesis_model,
                "n_questions": len(per_question),
                "aggregate": aggregate([q["scores"] for q in per_question]),
                "questions": per_question,
            }
            RESULTS_PATH.parent.mkdir(exist_ok=True)
            RESULTS_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
            _log.info("evals.run_done", **report["aggregate"])
        except Exception:
            _log.exception("evals.run_failed")
