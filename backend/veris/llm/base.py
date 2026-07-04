"""LLM provider port.

Adapters (Claude, stub) implement this. The router — not the adapter — owns tier→model
mapping, tracing, and cost accounting, so adapters stay thin.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class LLMProvider(Protocol):
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
        """Return ``(text, input_tokens, output_tokens)`` for a non-streaming call."""
        ...

    def stream(
        self,
        *,
        model: str,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 4096,
        thinking: bool = False,
    ) -> AsyncIterator[str]:
        """Yield text deltas for a streaming call."""
        ...
