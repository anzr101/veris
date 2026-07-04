"""LLM router tests: tier mapping, cost accounting, tracing, structured output, streaming.

Runs on the deterministic stub provider — no API key, no network.
"""

from __future__ import annotations

from veris.llm.anthropic_provider import _supports_effort_and_thinking
from veris.llm.pricing import cost_usd
from veris.llm.router import LLMRouter
from veris.llm.stub_provider import StubProvider
from veris.llm.types import ModelTier


def _router() -> LLMRouter:
    return LLMRouter(
        StubProvider(),
        synthesis_model="claude-opus-4-8",
        utility_model="claude-haiku-4-5",
    )


def test_pricing_matches_published_rates():
    # 1M input + 1M output on Opus 4.8 = $5 + $25.
    assert cost_usd("claude-opus-4-8", 1_000_000, 1_000_000) == 30.0
    # Haiku 4.5 = $1 + $5.
    assert cost_usd("claude-haiku-4-5", 1_000_000, 1_000_000) == 6.0
    # Unknown model degrades to zero cost rather than crashing accounting.
    assert cost_usd("mystery-model", 10, 10) == 0.0


def test_model_param_gating():
    # Effort / adaptive thinking apply to Opus/Sonnet-4.6/Fable, not Haiku.
    assert _supports_effort_and_thinking("claude-opus-4-8")
    assert _supports_effort_and_thinking("claude-sonnet-4-6")
    assert not _supports_effort_and_thinking("claude-haiku-4-5")


async def test_tier_maps_to_model():
    router = _router()
    assert router.model_for(ModelTier.SYNTHESIS) == "claude-opus-4-8"
    assert router.model_for(ModelTier.UTILITY) == "claude-haiku-4-5"


async def test_complete_records_trace_and_cost():
    router = _router()
    result = await router.complete(
        ModelTier.UTILITY, prompt="classify this", stage="decompose"
    )
    assert result.model == "claude-haiku-4-5"
    assert result.tier is ModelTier.UTILITY
    assert result.input_tokens > 0 and result.output_tokens > 0
    assert result.latency_ms >= 0
    # One traced call, totals wired through.
    assert len(router.tracer.calls) == 1
    assert router.tracer.total_cost_usd == result.cost_usd
    assert router.tracer.calls[0].model == "claude-haiku-4-5"


async def test_structured_output_returns_valid_json():
    router = _router()
    schema = {
        "type": "object",
        "properties": {
            "sub_queries": {"type": "array", "items": {"type": "string"}},
            "intent": {"type": "string", "enum": ["lookup", "synthesis"]},
        },
        "required": ["sub_queries", "intent"],
    }
    import json

    result = await router.complete(
        ModelTier.UTILITY, prompt="plan", stage="plan", json_schema=schema
    )
    parsed = json.loads(result.text)
    assert "sub_queries" in parsed and isinstance(parsed["sub_queries"], list)
    assert parsed["intent"] == "lookup"  # first enum value from the stub


async def test_streaming_yields_deltas():
    router = _router()
    chunks = [c async for c in router.stream(ModelTier.SYNTHESIS, prompt="write")]
    assert chunks
    assert "".join(chunks).startswith("[stub:claude-opus-4-8]")
