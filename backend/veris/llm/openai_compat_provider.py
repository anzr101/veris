"""OpenAI-compatible chat-completions adapter (Hugging Face Inference Providers et al.).

Speaks the ``/chat/completions`` dialect over plain ``httpx``, so any endpoint that
implements it works: the HF router (``https://router.huggingface.co/v1``), Groq,
Together, OpenRouter, or a local vLLM/Ollama. Structured output is not assumed —
provider support for ``response_format`` varies wildly across HF's routed backends —
so when a JSON schema is requested the schema is embedded in the prompt and the reply
is scrubbed of markdown fences before parsing upstream.

``effort``/``thinking`` are Claude-isms and are ignored here.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from veris.llm.errors import LLMUnavailableError

_TIMEOUT = httpx.Timeout(120.0, connect=10.0)


def extract_json(text: str) -> str:
    """Return the JSON payload inside a model reply that may wrap it in prose/fences."""
    s = text.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[1] if "\n" in s else s
        if s.rstrip().endswith("```"):
            s = s.rstrip()[:-3]
        s = s.strip()
    if s.startswith("{") or s.startswith("["):
        return s
    # Fall back to the outermost braces in the reply.
    start, end = s.find("{"), s.rfind("}")
    if start != -1 and end > start:
        return s[start : end + 1]
    return s


class OpenAICompatProvider:
    def __init__(self, api_key: str, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=_TIMEOUT,
        )

    def _payload(
        self,
        *,
        model: str,
        prompt: str,
        system: str | None,
        max_tokens: int,
        json_schema: dict[str, Any] | None,
        stream: bool,
    ) -> dict[str, Any]:
        if json_schema is not None:
            prompt = (
                f"{prompt}\n\n"
                "Respond with ONLY a raw JSON value matching this JSON Schema — "
                "no markdown fences, no commentary:\n"
                f"{json.dumps(json_schema)}"
            )
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if stream:
            payload["stream"] = True
        return payload

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
        payload = self._payload(
            model=model,
            prompt=prompt,
            system=system,
            max_tokens=max_tokens,
            json_schema=json_schema,
            stream=False,
        )
        try:
            resp = await self._client.post(f"{self._base_url}/chat/completions", json=payload)
        except httpx.HTTPError as e:
            raise LLMUnavailableError("openai_compat", f"network error: {e}") from e
        if resp.status_code >= 400:
            raise LLMUnavailableError(
                "openai_compat", f"HTTP {resp.status_code}: {resp.text[:300]}"
            )
        data = resp.json()
        text = data["choices"][0]["message"].get("content") or ""
        if json_schema is not None:
            text = extract_json(text)
        usage = data.get("usage") or {}
        return text, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)

    async def stream(
        self,
        *,
        model: str,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 4096,
        thinking: bool = False,
    ) -> AsyncIterator[str]:
        payload = self._payload(
            model=model,
            prompt=prompt,
            system=system,
            max_tokens=max_tokens,
            json_schema=None,
            stream=True,
        )
        try:
            async with self._client.stream(
                "POST", f"{self._base_url}/chat/completions", json=payload
            ) as resp:
                if resp.status_code >= 400:
                    body = (await resp.aread()).decode(errors="replace")
                    raise LLMUnavailableError(
                        "openai_compat", f"HTTP {resp.status_code}: {body[:300]}"
                    )
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    chunk = line[len("data:") :].strip()
                    if not chunk or chunk == "[DONE]":
                        continue
                    try:
                        delta = json.loads(chunk)["choices"][0].get("delta", {})
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
                    content = delta.get("content")
                    if content:
                        yield content
        except httpx.HTTPError as e:
            raise LLMUnavailableError("openai_compat", f"network error: {e}") from e
