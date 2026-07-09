"""Eval harness: run the benchmark through AskService and score faithfulness.

    python -m veris.evals.harness

Writes ``results/latest.json`` (served by GET /v1/evals and the public dashboard). In CI
this is the gate: a drop in aggregate faithfulness should fail the build.
"""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from veris.api.state import Services
from veris.config import get_settings
from veris.core.logging import configure_logging, get_logger
from veris.evals.metrics import aggregate, score_answer

_log = get_logger("veris.evals")

_BENCH_PATH = Path(__file__).parent / "benchmark.json"
_RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_PATH = _RESULTS_DIR / "latest.json"


def load_benchmark() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(_BENCH_PATH.read_text(encoding="utf-8"))
    return data


async def run() -> dict[str, Any]:
    settings = get_settings()
    configure_logging(settings.log_level)
    services = await Services.create(settings)
    bench = load_benchmark()

    per_question: list[dict[str, Any]] = []
    try:
        for question in bench["questions"]:
            answer = await services.ask.ask(question)
            scores = score_answer(answer)
            per_question.append({"question": question, "scores": scores})
            _log.info("eval.question", question=question, **scores)
    finally:
        await services.close()

    report = {
        "benchmark": bench["name"],
        "generated_at": datetime.now(UTC).isoformat(),
        "model": settings.effective_synthesis_model,
        "n_questions": len(per_question),
        "aggregate": aggregate([q["scores"] for q in per_question]),
        "questions": per_question,
    }
    _RESULTS_DIR.mkdir(exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    report = asyncio.run(run())
    agg = report["aggregate"]
    print(json.dumps(agg, indent=2))


if __name__ == "__main__":
    main()
