"""Synthesizer — builds citations from retrieved chunks and generates the grounded answer."""

from __future__ import annotations

from collections.abc import AsyncIterator

from veris.domain.answer import Citation
from veris.domain.models import ScoredChunk
from veris.llm.router import LLMRouter
from veris.llm.types import LLMResult, ModelTier
from veris.synthesis.prompts import SYNTHESIS_SYSTEM, build_synthesis_prompt


def _snippet(text: str, limit: int = 240) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def build_citations(chunks: list[ScoredChunk]) -> list[Citation]:
    """Map retrieved chunks to numbered citations (1-based, matching prompt order)."""
    return [
        Citation(
            index=i,
            chunk_id=c.chunk_id,
            arxiv_id=c.arxiv_id,
            paper_title=c.paper_title,
            section=c.section,
            snippet=_snippet(c.text),
            url=f"https://arxiv.org/abs/{c.arxiv_id}",
        )
        for i, c in enumerate(chunks, start=1)
    ]


class Synthesizer:
    def __init__(self, router: LLMRouter, *, effort: str = "medium") -> None:
        self._router = router
        self._effort = effort

    async def synthesize(
        self, question: str, chunks: list[ScoredChunk], *, max_tokens: int = 2048
    ) -> LLMResult:
        return await self._router.complete(
            ModelTier.SYNTHESIS,
            prompt=build_synthesis_prompt(question, chunks),
            system=SYNTHESIS_SYSTEM,
            stage="synthesize",
            max_tokens=max_tokens,
            effort=self._effort,
            thinking=True,
        )

    def stream(
        self, question: str, chunks: list[ScoredChunk], *, max_tokens: int = 2048
    ) -> AsyncIterator[str]:
        return self._router.stream(
            ModelTier.SYNTHESIS,
            prompt=build_synthesis_prompt(question, chunks),
            system=SYNTHESIS_SYSTEM,
            max_tokens=max_tokens,
            thinking=True,
        )
