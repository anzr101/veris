"""Deterministic stub provider — runs the full pipeline with no API key.

Activated automatically when ``ANTHROPIC_API_KEY`` is unset (e.g. CI). It does not call
any network; it returns canned, structurally-valid output so tests exercise the wiring
without spending tokens. It is never used when a real key is present.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any


def _default_for_schema(schema: dict[str, Any]) -> Any:
    """Produce a minimal value satisfying a (subset of) JSON Schema."""
    t = schema.get("type")
    if t == "object":
        props = schema.get("properties", {})
        return {k: _default_for_schema(v) for k, v in props.items()}
    if t == "array":
        return []
    if t == "string":
        return schema.get("enum", ["stub"])[0]
    if t == "integer":
        return 0
    if t == "number":
        return 0.0
    if t == "boolean":
        return False
    return None


class StubProvider:
    async def complete(
        self,
        *,
        model: str,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 4096,
        json_schema: dict[str, Any] | None = None,
        effort: str | None = None,
        thinking: bool = False,
    ) -> tuple[str, int, int]:
        if json_schema is not None:
            text = json.dumps(_default_for_schema(json_schema))
        else:
            text = f"[stub:{model}] {prompt[:120]}"
        # Rough token accounting so cost/latency plumbing has non-zero values to carry.
        return text, max(1, len(prompt) // 4), max(1, len(text) // 4)

    async def stream(
        self,
        *,
        model: str,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 4096,
        thinking: bool = False,
    ) -> AsyncIterator[str]:
        for token in (f"[stub:{model}]", " ", "synthesized", " ", "answer."):
            yield token
