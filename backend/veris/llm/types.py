"""Shared LLM types."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class ModelTier(StrEnum):
    """Cost tier. The router maps a tier to a concrete model id.

    UTILITY  → cheap, high-volume calls (query planning, claim extraction, classification).
    SYNTHESIS → the final, quality-critical answer.
    """

    UTILITY = "utility"
    SYNTHESIS = "synthesis"


@dataclass(slots=True)
class LLMResult:
    """A completed (non-streaming) generation plus accounting."""

    text: str
    model: str
    tier: ModelTier
    input_tokens: int
    output_tokens: int
    latency_ms: float
    cost_usd: float
