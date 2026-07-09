"""LLM provider errors.

Adapters translate vendor-specific failures (auth, exhausted credits, rate limits,
network) into ``LLMUnavailableError`` so the API layer can return a clear 503 instead
of leaking a raw 500 from deep inside a pipeline.
"""

from __future__ import annotations


class LLMUnavailableError(RuntimeError):
    """The configured LLM provider cannot serve requests right now."""

    def __init__(self, provider: str, detail: str) -> None:
        self.provider = provider
        self.detail = detail
        super().__init__(f"LLM provider '{provider}' unavailable: {detail}")
