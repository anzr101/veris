"""Per-model pricing (USD per 1M tokens) and cost computation.

Source: Anthropic model pricing as of 2026-06. Kept as a small table rather than a live
lookup so cost accounting is deterministic and offline-friendly.
"""

from __future__ import annotations

# model id -> (input $/MTok, output $/MTok)
_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4-8": (5.0, 25.0),
    "claude-opus-4-7": (5.0, 25.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
}


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """Compute the USD cost of a call. Unknown models cost 0 (and are logged upstream)."""
    rates = _PRICING.get(model)
    if rates is None:
        return 0.0
    in_rate, out_rate = rates
    return (input_tokens / 1_000_000) * in_rate + (output_tokens / 1_000_000) * out_rate
