"""Build the LLM router from settings.

Claude when ``ANTHROPIC_API_KEY`` is set (the user's default); the deterministic stub
otherwise, so the pipeline and tests run with no key.
"""

from __future__ import annotations

from veris.config import Settings
from veris.core.logging import get_logger
from veris.llm.base import LLMProvider
from veris.llm.router import LLMRouter

_log = get_logger("veris.llm")


def build_provider(settings: Settings) -> LLMProvider:
    if settings.anthropic_api_key:
        from veris.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider(settings.anthropic_api_key)

    from veris.llm.stub_provider import StubProvider

    _log.warning("llm.stub_active", reason="ANTHROPIC_API_KEY not set")
    return StubProvider()


def build_router(settings: Settings) -> LLMRouter:
    return LLMRouter(
        build_provider(settings),
        synthesis_model=settings.synthesis_model,
        utility_model=settings.utility_model,
    )
