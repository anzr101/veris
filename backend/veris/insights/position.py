"""Position-my-research: place a research idea in the literature.

Reuses the existing retrieval + synthesis + grounding stack. Collaborator discovery uses
ONLY public arXiv author metadata (names + their public papers + a public-profile search
link) — never contact info. That restraint is a deliberate design choice, not a limitation.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any
from urllib.parse import quote_plus

from veris.config import Settings
from veris.domain.insights import Collaborator, PaperRef, PositionReport, ScoredPaper
from veris.domain.models import ScoredChunk
from veris.embeddings.base import Embedder
from veris.grounding.verifier import Grounder
from veris.llm.base import LLMProvider
from veris.llm.router import LLMRouter
from veris.llm.tracing import Tracer
from veris.llm.types import ModelTier
from veris.storage.base import Store
from veris.synthesis.synthesizer import Synthesizer, build_citations

_GAPS_SCHEMA = {
    "type": "object",
    "properties": {"gaps": {"type": "array", "items": {"type": "string"}}},
    "required": ["gaps"],
    "additionalProperties": False,
}
_GAPS_SYSTEM = (
    "You identify concrete, under-explored research gaps. Given a research idea and the titles "
    "of the nearest existing papers, list 2-4 specific opportunities the idea could pursue that "
    "the existing work does not already cover. Be specific and grounded — no generic filler."
)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _best_chunk_per_paper(chunks: list[ScoredChunk]) -> list[ScoredChunk]:
    best: dict[str, ScoredChunk] = {}
    for c in chunks:
        cur = best.get(c.arxiv_id)
        if cur is None or c.score > cur.score:
            best[c.arxiv_id] = c
    return sorted(best.values(), key=lambda c: c.score, reverse=True)


class PositionService:
    def __init__(
        self, provider: LLMProvider, store: Store, embedder: Embedder, settings: Settings
    ) -> None:
        self._provider = provider
        self._store = store
        self._embedder = embedder
        self._settings = settings

    def _router(self, tracer: Tracer) -> LLMRouter:
        return LLMRouter(
            self._provider,
            synthesis_model=self._settings.effective_synthesis_model,
            utility_model=self._settings.effective_utility_model,
            tracer=tracer,
        )

    async def position(self, text: str) -> PositionReport:
        start = time.perf_counter()
        tracer = Tracer()
        router = self._router(tracer)

        vec = self._embedder.embed_query(text)
        chunks = await self._store.dense_search(vec, top_k=40)
        if not chunks:
            return PositionReport(input=text, novelty_score=1.0)

        ranked = _best_chunk_per_paper(chunks)[:12]
        sims = [c.score for c in ranked]
        top_sims = sims[:10]
        mean_sim = sum(top_sims) / len(top_sims)
        density = _clamp01(mean_sim)
        novelty = _clamp01(1.0 - mean_sim)
        crowded = sum(1 for s in sims if s > 0.5)

        # Paper metadata for the nearest work + collaborators (public author data only).
        papers = await asyncio.gather(
            *(self._store.get_paper_by_arxiv_id(c.arxiv_id) for c in ranked)
        )
        nearest: list[ScoredPaper] = []
        for chunk, paper in zip(ranked, papers, strict=True):
            if paper is None:
                continue
            nearest.append(
                ScoredPaper(
                    arxiv_id=paper.arxiv_id,
                    title=paper.title,
                    authors=paper.authors,
                    categories=paper.categories,
                    year=paper.published_at.year if paper.published_at else None,
                    score=round(chunk.score, 4),
                    url=f"https://arxiv.org/abs/{paper.arxiv_id}",
                )
            )

        collaborators = _collaborators(nearest)

        # Grounded related-work draft over the nearest evidence.
        synth = Synthesizer(router)
        citations = build_citations(ranked)
        question = (
            "Write a concise related-work synthesis that positions the following research idea "
            f"against the retrieved prior work, citing each claim.\n\nIdea: {text}"
        )
        synth_result = await synth.synthesize(question, ranked, max_tokens=1200)
        claims = await Grounder(router).verify(synth_result.text, ranked)

        gaps = await _gaps(router, text, [p.title for p in nearest])

        return PositionReport(
            input=text,
            novelty_score=round(novelty, 3),
            density=round(density, 3),
            crowded_count=crowded,
            nearest=nearest,
            collaborators=collaborators,
            gaps=gaps,
            related_work_markdown=synth_result.text,
            citations=citations,
            claims=claims,
            model=synth_result.model,
            cost_usd=tracer.total_cost_usd,
            latency_ms=(time.perf_counter() - start) * 1000,
        )


def _collaborators(nearest: list[ScoredPaper], *, limit: int = 8) -> list[Collaborator]:
    agg: dict[str, dict[str, Any]] = {}
    for paper in nearest:
        for name in paper.authors:
            key = name.strip()
            if not key:
                continue
            entry = agg.setdefault(key, {"count": 0, "score": 0.0, "papers": []})
            entry["count"] += 1
            entry["score"] += paper.score
            if len(entry["papers"]) < 3:
                entry["papers"].append(PaperRef(arxiv_id=paper.arxiv_id, title=paper.title))

    ranked = sorted(agg.items(), key=lambda kv: (kv[1]["count"], kv[1]["score"]), reverse=True)
    return [
        Collaborator(
            name=name,
            paper_count=data["count"],
            sample_papers=data["papers"],
            profile_url=f"https://scholar.google.com/scholar?q={quote_plus(name)}",
        )
        for name, data in ranked[:limit]
    ]


async def _gaps(router: LLMRouter, text: str, titles: list[str]) -> list[str]:
    if not titles:
        return []
    prompt = (
        f"Research idea:\n{text}\n\nNearest existing papers:\n"
        + "\n".join(f"- {t}" for t in titles)
        + "\n\nList the specific under-explored gaps this idea could target."
    )
    result = await router.complete(
        ModelTier.UTILITY,
        prompt=prompt,
        system=_GAPS_SYSTEM,
        stage="gaps",
        max_tokens=400,
        json_schema=_GAPS_SCHEMA,
    )
    try:
        data = json.loads(result.text)
        return [g for g in data.get("gaps", []) if isinstance(g, str) and g.strip()]
    except json.JSONDecodeError:
        return []
