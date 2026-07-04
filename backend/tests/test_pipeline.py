"""End-to-end: seed a corpus, run the grounded-answer pipeline, hit the HTTP API.

Fully offline — stub LLM provider, in-memory SQLite, deterministic hashing embedder.
"""

from __future__ import annotations

import os

import pytest

# Configure a zero-infra, no-key environment before settings are first read.
os.environ.update(
    {
        "VERIS_ENV": "development",
        "VERIS_EMBEDDING_MODEL": "hashing",
        "VERIS_DATABASE_URL": "sqlite:///:memory:",
    }
)
os.environ.pop("ANTHROPIC_API_KEY", None)

from veris.config import get_settings  # noqa: E402
from veris.domain.models import ChunkInput, Paper  # noqa: E402
from veris.ingestion.chunker import chunk_paper  # noqa: E402

_PAPERS = [
    Paper(
        arxiv_id="2401.00001",
        title="Coordinating Multi-Agent Systems with Transformers",
        abstract=(
            "We study multi-agent reinforcement learning. We propose a transformer policy "
            "with attention over agent observations. Our approach improves sample efficiency "
            "on cooperative navigation tasks."
        ),
        categories=["cs.LG", "cs.MA"],
    ),
    Paper(
        arxiv_id="2401.00002",
        title="Retrieval-Augmented Generation for Question Answering",
        abstract=(
            "Retrieval-augmented generation combines a retriever with a generator. Dense and "
            "sparse retrieval are fused to improve grounding. The method reduces hallucination "
            "by conditioning on retrieved passages."
        ),
        categories=["cs.CL"],
    ),
    Paper(
        arxiv_id="2401.00003",
        title="Diffusion Models for Text-to-Image Synthesis",
        abstract=(
            "Diffusion models generate images from text prompts using iterative denoising. "
            "Classifier-free guidance improves prompt fidelity."
        ),
        categories=["cs.CV"],
    ),
]


@pytest.fixture
async def services():
    get_settings.cache_clear()
    from veris.api.state import Services

    svc = await Services.create(get_settings())
    # Seed the corpus directly (no network).
    for paper in _PAPERS:
        pid = await svc.store.upsert_paper(paper)
        chunks = chunk_paper(paper)
        vectors = svc.embedder.embed_documents([c.text for c in chunks])
        inputs = [
            ChunkInput(
                ordinal=i, section=c.section, text=c.text,
                token_count=len(c.text.split()), embedding=v,
            )
            for i, (c, v) in enumerate(zip(chunks, vectors, strict=True))
        ]
        await svc.store.replace_chunks(pid, inputs, model=svc.embedder.name)
    try:
        yield svc
    finally:
        await svc.close()


async def test_corpus_seeded(services):
    assert await services.store.count_papers() == 3
    assert await services.store.count_chunks() > 3


async def test_ask_pipeline_produces_grounded_answer(services):
    answer = await services.ask.ask("How does retrieval-augmented generation reduce hallucination?")
    # Plan ran, retrieval returned citable evidence, synthesis produced text.
    assert answer.plan is not None and answer.plan.sub_queries
    assert answer.citations, "expected at least one citation"
    assert answer.markdown
    # RAG paper should surface among the citations for this question.
    assert any(c.arxiv_id == "2401.00002" for c in answer.citations)
    # Cost accounting is wired (stub returns priced models).
    assert answer.cost_usd >= 0
    # Faithfulness is well-defined even with no verified claims (stub returns none).
    assert 0.0 <= answer.faithfulness <= 1.0


async def test_streaming_events_order(services):
    seen = []
    async for event in services.ask.ask_stream("What improves sample efficiency in MARL?"):
        seen.append(event["type"])
    assert seen[0] == "plan"
    assert "citations" in seen
    assert "token" in seen
    assert seen[-1] == "done"
