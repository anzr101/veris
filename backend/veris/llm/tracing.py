"""Per-call LLM tracing.

Every model call is recorded with model, tier, token counts, latency, and computed cost,
tagged by pipeline stage. In production this is the hook for Langfuse/OpenTelemetry; here
it emits structured logs and accumulates totals for the cost report.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from veris.core.logging import get_logger
from veris.llm.types import LLMResult

_log = get_logger("veris.llm")


@dataclass
class Tracer:
    """Collects LLM-call telemetry for a single request (or process)."""

    calls: list[LLMResult] = field(default_factory=list)

    def record(self, stage: str, result: LLMResult) -> None:
        self.calls.append(result)
        _log.info(
            "llm.call",
            stage=stage,
            model=result.model,
            tier=result.tier.value,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            latency_ms=round(result.latency_ms, 1),
            cost_usd=round(result.cost_usd, 6),
        )

    @property
    def total_cost_usd(self) -> float:
        return sum(c.cost_usd for c in self.calls)

    @property
    def total_tokens(self) -> int:
        return sum(c.input_tokens + c.output_tokens for c in self.calls)
