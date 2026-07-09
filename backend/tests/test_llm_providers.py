"""Provider selection and the OpenAI-compatible adapter's response handling.

No network: selection is pure settings logic, and JSON extraction is a pure function.
"""

from __future__ import annotations

import json

from veris.config import Settings
from veris.llm.factory import build_provider, build_router
from veris.llm.openai_compat_provider import OpenAICompatProvider, extract_json
from veris.llm.stub_provider import StubProvider
from veris.llm.types import ModelTier


def _settings(**overrides) -> Settings:
    # anthropic_api_key / hf_token are aliased fields — set them by alias.
    base = {"ANTHROPIC_API_KEY": "", "HF_TOKEN": ""}
    base.update(overrides)
    return Settings(**base)


def test_auto_resolves_stub_when_no_keys():
    s = _settings()
    assert s.active_llm_provider == "stub"
    assert isinstance(build_provider(s), StubProvider)


def test_auto_prefers_anthropic_over_hf():
    s = _settings(ANTHROPIC_API_KEY="sk-ant-test", HF_TOKEN="hf_test")
    assert s.active_llm_provider == "anthropic"
    assert s.effective_synthesis_model == s.synthesis_model


def test_auto_falls_back_to_hf_and_swaps_models():
    s = _settings(HF_TOKEN="hf_test")
    assert s.active_llm_provider == "hf"
    assert s.effective_synthesis_model == s.oss_synthesis_model
    assert s.effective_utility_model == s.oss_utility_model
    assert isinstance(build_provider(s), OpenAICompatProvider)


def test_explicit_provider_overrides_auto():
    # A set-but-dead Anthropic key can be bypassed without unsetting it.
    s = _settings(llm_provider="hf", ANTHROPIC_API_KEY="sk-ant-dead", HF_TOKEN="hf_test")
    assert s.active_llm_provider == "hf"
    router = build_router(s)
    assert router.model_for(ModelTier.SYNTHESIS) == s.oss_synthesis_model


def test_extract_json_handles_fences_and_prose():
    payload = {"claims": [{"claim": "x", "status": "supported", "confidence": 1.0}]}
    raw = json.dumps(payload)
    fenced = f"```json\n{raw}\n```"
    prose = f"Here is the JSON you asked for:\n{raw}\nHope that helps!"
    for text in (raw, fenced, prose):
        assert json.loads(extract_json(text)) == payload
