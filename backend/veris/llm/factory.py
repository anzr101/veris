"""Build the LLM router from settings.

Adapter selection (``VERIS_LLM_PROVIDER``, default ``auto``): Claude when
``ANTHROPIC_API_KEY`` is set, otherwise the Hugging Face Inference router (any
OpenAI-compatible endpoint) when ``HF_TOKEN`` is set, otherwise the deterministic
stub so the pipeline and tests run with no key. The tier→model mapping follows the
adapter via ``settings.effective_*_model`` (Claude ids vs open-weights ids).
"""

from __future__ import annotations

from veris.config import Settings
from veris.core.logging import get_logger
from veris.llm.base import LLMProvider
from veris.llm.router import LLMRouter

_log = get_logger("veris.llm")


def build_provider(settings: Settings) -> LLMProvider:
    kind = settings.active_llm_provider

    if kind == "anthropic":
        from veris.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider(settings.anthropic_api_key)

    if kind == "hf":
        from veris.llm.openai_compat_provider import OpenAICompatProvider

        _log.info("llm.openai_compat_active", base_url=settings.llm_base_url)
        return OpenAICompatProvider(settings.hf_token, settings.llm_base_url)

    from veris.llm.stub_provider import StubProvider

    _log.warning("llm.stub_active", reason="no ANTHROPIC_API_KEY or HF_TOKEN set")
    return StubProvider()


def build_router(settings: Settings) -> LLMRouter:
    return LLMRouter(
        build_provider(settings),
        synthesis_model=settings.effective_synthesis_model,
        utility_model=settings.effective_utility_model,
    )
