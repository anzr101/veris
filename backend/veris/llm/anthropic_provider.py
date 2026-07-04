"""Claude adapter built on the official ``anthropic`` AsyncAnthropic SDK.

Model-aware by design. The Opus/Sonnet 4.6+ family rejects ``temperature``/``top_p``/
``top_k`` and ``budget_tokens`` (HTTP 400) and instead exposes adaptive thinking plus
``output_config.effort``; Haiku 4.5 supports neither effort nor adaptive thinking. This
adapter therefore never sends sampling params and only attaches ``effort``/``thinking`` to
models that accept them, so the same call site works across tiers.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

# Families that accept output_config.effort and adaptive thinking.
_EFFORT_THINKING_PREFIXES = ("claude-opus-4-", "claude-sonnet-4-6", "claude-fable-")


def _supports_effort_and_thinking(model: str) -> bool:
    return model.startswith(_EFFORT_THINKING_PREFIXES)


class AnthropicProvider:
    def __init__(self, api_key: str) -> None:
        from anthropic import AsyncAnthropic

        self._client = AsyncAnthropic(api_key=api_key)

    def _build_kwargs(
        self,
        *,
        model: str,
        prompt: str,
        system: str | None,
        max_tokens: int,
        json_schema: dict[str, Any] | None,
        effort: str | None,
        thinking: bool,
    ) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system

        output_config: dict[str, Any] = {}
        if json_schema is not None:
            output_config["format"] = {"type": "json_schema", "schema": json_schema}
        if effort and _supports_effort_and_thinking(model):
            output_config["effort"] = effort
        if output_config:
            kwargs["output_config"] = output_config

        if thinking and _supports_effort_and_thinking(model):
            kwargs["thinking"] = {"type": "adaptive"}
        return kwargs

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
        kwargs = self._build_kwargs(
            model=model,
            prompt=prompt,
            system=system,
            max_tokens=max_tokens,
            json_schema=json_schema,
            effort=effort,
            thinking=thinking,
        )
        resp = await self._client.messages.create(**kwargs)
        text = "".join(b.text for b in resp.content if b.type == "text")
        return text, resp.usage.input_tokens, resp.usage.output_tokens

    async def complete_json(
        self,
        *,
        model: str,
        prompt: str,
        schema: dict[str, Any],
        system: str | None = None,
        max_tokens: int = 4096,
    ) -> tuple[dict[str, Any], int, int]:
        """Convenience wrapper that parses a structured-output response into a dict."""
        text, in_tok, out_tok = await self.complete(
            model=model,
            prompt=prompt,
            system=system,
            max_tokens=max_tokens,
            json_schema=schema,
        )
        return json.loads(text), in_tok, out_tok

    async def stream(
        self,
        *,
        model: str,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 4096,
        thinking: bool = False,
    ) -> AsyncIterator[str]:
        kwargs = self._build_kwargs(
            model=model,
            prompt=prompt,
            system=system,
            max_tokens=max_tokens,
            json_schema=None,
            effort=None,
            thinking=thinking,
        )
        async with self._client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text
