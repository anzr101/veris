"""Cost-tiered router.

Owns the tier→model mapping and wraps every provider call with timing, cost computation,
and tracing. Application services ask for a *tier* (UTILITY / SYNTHESIS), never a model id,
so the cost policy lives in exactly one place.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from typing import Any

from veris.llm.base import LLMProvider
from veris.llm.pricing import cost_usd
from veris.llm.tracing import Tracer
from veris.llm.types import LLMResult, ModelTier


class LLMRouter:
    def __init__(
        self,
        provider: LLMProvider,
        *,
        synthesis_model: str,
        utility_model: str,
        tracer: Tracer | None = None,
    ) -> None:
        self._provider = provider
        self._models = {
            ModelTier.SYNTHESIS: synthesis_model,
            ModelTier.UTILITY: utility_model,
        }
        self.tracer = tracer or Tracer()

    def model_for(self, tier: ModelTier) -> str:
        return self._models[tier]

    async def complete(
        self,
        tier: ModelTier,
        *,
        prompt: str,
        stage: str,
        system: str | None = None,
        max_tokens: int = 4096,
        json_schema: dict[str, Any] | None = None,
        effort: str | None = None,
        thinking: bool = False,
    ) -> LLMResult:
        model = self._models[tier]
        start = time.perf_counter()
        text, in_tok, out_tok = await self._provider.complete(
            model=model,
            prompt=prompt,
            system=system,
            max_tokens=max_tokens,
            json_schema=json_schema,
            effort=effort,
            thinking=thinking,
        )
        latency_ms = (time.perf_counter() - start) * 1000
        result = LLMResult(
            text=text,
            model=model,
            tier=tier,
            input_tokens=in_tok,
            output_tokens=out_tok,
            latency_ms=latency_ms,
            cost_usd=cost_usd(model, in_tok, out_tok),
        )
        self.tracer.record(stage, result)
        return result

    async def stream(
        self,
        tier: ModelTier,
        *,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 4096,
        thinking: bool = False,
    ) -> AsyncIterator[str]:
        model = self._models[tier]
        async for delta in self._provider.stream(
            model=model,
            prompt=prompt,
            system=system,
            max_tokens=max_tokens,
            thinking=thinking,
        ):
            yield delta
