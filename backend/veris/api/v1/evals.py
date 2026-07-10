"""Eval dashboard endpoints — serve, and self-populate, the faithfulness report.

The report is a file on an ephemeral filesystem, so it disappears on every container
restart. Rather than asking anyone to run a CLI, the dashboard is self-serve: the first
GET after boot kicks a background benchmark run against the live corpus and provider,
and the page polls until the report lands. ``POST /evals/run`` forces a re-run.

The runner is deliberately patient: free-tier LLM providers enforce tokens-per-minute
caps, so questions are spaced out and each one retries on provider errors instead of
failing the whole run.
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
from veris.llm.errors import LLMUnavailableError

_log = get_logger("veris.evals.api")

router = APIRouter()

_run_lock = asyncio.Lock()

# Pacing for free-tier provider quotas (tokens per minute).
_QUESTION_GAP_S = 25
_RETRY_GAP_S = 30
_MAX_ATTEMPTS = 3


def _placeholder(note: str) -> dict[str, Any]:
    return {
        "benchmark": "veris-core-bench",
        "generated_at": None,
        "aggregate": {},
        "questions": [],
        "note": note,
    }


@router.get("/evals")
async def latest_evals(services: Services = Depends(get_services)) -> dict[str, Any]:
    """Return the latest report; if none exists yet, start a run and say so."""
    if RESULTS_PATH.exists():
        report: dict[str, Any] = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
        return report
    if _run_lock.locked():
        return _placeholder("Benchmark run in progress — results appear here in a few minutes.")
    if await services.store.count_papers() > 0:
        asyncio.get_running_loop().create_task(_run_benchmark(services))
        return _placeholder("Benchmark run started — results appear here in a few minutes.")
    return _placeholder("No corpus yet — ingest papers, then the benchmark runs automatically.")


@router.post("/evals/run", status_code=202)
@limiter.limit("1/hour")
async def run_evals(
    request: Request, services: Services = Depends(get_services)
) -> dict[str, str]:
    """Force a fresh benchmark run against the live corpus."""
    if _run_lock.locked():
        return {"status": "already-running"}
    asyncio.get_running_loop().create_task(_run_benchmark(services))
    return {"status": "started", "questions": str(len(load_benchmark()["questions"]))}


async def _ask_with_retries(services: Services, question: str) -> Any | None:
    """One benchmark question, retried across transient provider outages."""
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            return await services.ask.ask(question)
        except LLMUnavailableError as e:
            _log.warning(
                "evals.question_retry", question=question, attempt=attempt, detail=e.detail
            )
            if attempt < _MAX_ATTEMPTS:
                await asyncio.sleep(_RETRY_GAP_S)
    return None


async def _run_benchmark(services: Services) -> None:
    if _run_lock.locked():
        return
    async with _run_lock:
        bench = load_benchmark()
        questions: list[str] = bench["questions"]
        per_question: list[dict[str, Any]] = []
        _log.info("evals.run_start", n_questions=len(questions))
        try:
            for i, question in enumerate(questions):
                if i > 0:
                    await asyncio.sleep(_QUESTION_GAP_S)  # stay under provider TPM caps
                answer = await _ask_with_retries(services, question)
                if answer is None:
                    _log.error("evals.question_skipped", question=question)
                    continue
                per_question.append({"question": question, "scores": score_answer(answer)})

            if not per_question:
                _log.error("evals.run_empty")
                return

            report: dict[str, Any] = {
                "benchmark": bench["name"],
                "generated_at": datetime.now(UTC).isoformat(),
                "model": services.settings.effective_synthesis_model,
                "n_questions": len(per_question),
                "aggregate": aggregate([q["scores"] for q in per_question]),
                "questions": per_question,
            }
            if len(per_question) < len(questions):
                report["note"] = (
                    f"Partial run: {len(per_question)}/{len(questions)} questions completed "
                    "(provider rate limits); re-run via POST /v1/evals/run."
                )
            RESULTS_PATH.parent.mkdir(exist_ok=True)
            RESULTS_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
            _log.info("evals.run_done", **report["aggregate"])
        except Exception:
            _log.exception("evals.run_failed")
