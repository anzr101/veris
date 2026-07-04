"""Data-layer integration test: embed → persist → dense + sparse retrieval.

Runs entirely in-process: in-memory SQLite + the deterministic hashing embedder. No model
download, no external services — exactly the path a contributor (or CI) runs.
"""

from __future__ import annotations

import pytest

from veris.domain.models import ChunkInput, Paper, RetrievalFilters
from veris.embeddings.hashing import HashingEmbedder
from veris.storage.sqlite_store import SqliteStore

PASSAGES = [
    ("Introduction", "Multi-agent reinforcement learning coordinates many autonomous agents."),
    ("Method", "We propose a transformer policy with attention over agent observations."),
    ("Results", "Our approach improves sample efficiency on cooperative navigation tasks."),
    ("Related", "Diffusion models generate images from text prompts using denoising."),
]


@pytest.fixture
async def store():
    s = SqliteStore(":memory:")
    await s.initialize()
    try:
        yield s
    finally:
        await s.close()


async def _seed(store: SqliteStore, embedder: HashingEmbedder) -> int:
    paper = Paper(
        arxiv_id="2401.00001",
        title="Coordinating Multi-Agent Systems with Transformers",
        abstract="A study of multi-agent reinforcement learning.",
        authors=["A. Researcher"],
        categories=["cs.LG", "cs.MA"],
    )
    paper_id = await store.upsert_paper(paper)
    vectors = embedder.embed_documents([text for _, text in PASSAGES])
    chunks = [
        ChunkInput(
            ordinal=i,
            section=section,
            text=text,
            token_count=len(text.split()),
            embedding=vec,
        )
        for i, ((section, text), vec) in enumerate(zip(PASSAGES, vectors, strict=True))
    ]
    await store.replace_chunks(paper_id, chunks, model=embedder.name)
    return paper_id


async def test_ingest_and_counts(store: SqliteStore):
    embedder = HashingEmbedder()
    await _seed(store, embedder)
    assert await store.count_papers() == 1
    assert await store.count_chunks() == len(PASSAGES)


async def test_dense_search_ranks_semantically(store: SqliteStore):
    embedder = HashingEmbedder()
    await _seed(store, embedder)
    q = embedder.embed_query("multi-agent reinforcement learning coordination")
    hits = await store.dense_search(q, top_k=3)
    assert hits, "expected dense hits"
    # The diffusion/text-to-image passage should not be the top result.
    assert "diffusion" not in hits[0].text.lower()
    assert hits[0].rank == 1
    assert all(hits[i].score >= hits[i + 1].score for i in range(len(hits) - 1))


async def test_sparse_bm25_search(store: SqliteStore):
    embedder = HashingEmbedder()
    await _seed(store, embedder)
    hits = await store.sparse_search("diffusion denoising images", top_k=3)
    assert hits, "expected sparse hits"
    assert "diffusion" in hits[0].text.lower()


async def test_replace_chunks_is_idempotent(store: SqliteStore):
    embedder = HashingEmbedder()
    paper_id = await _seed(store, embedder)
    # Re-ingest the same paper; chunk count must not double.
    vectors = embedder.embed_documents([t for _, t in PASSAGES])
    chunks = [
        ChunkInput(ordinal=i, section=s, text=t, token_count=1, embedding=v)
        for i, ((s, t), v) in enumerate(zip(PASSAGES, vectors, strict=True))
    ]
    await store.replace_chunks(paper_id, chunks, model=embedder.name)
    assert await store.count_chunks() == len(PASSAGES)


async def test_category_filter_excludes_nonmatching(store: SqliteStore):
    embedder = HashingEmbedder()
    await _seed(store, embedder)
    q = embedder.embed_query("agents")
    hits = await store.dense_search(
        q, top_k=5, filters=RetrievalFilters(categories=["cs.CV"])
    )
    assert hits == []  # paper is cs.LG/cs.MA, not cs.CV
