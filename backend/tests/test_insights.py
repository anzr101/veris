"""Map of Science build pipeline — projection, clustering, labeling, artifact.

Offline: hashing embedder + stub LLM + in-memory SQLite.
"""

from __future__ import annotations

import os

os.environ.update(
    {
        "VERIS_ENV": "development",
        "VERIS_EMBEDDING_MODEL": "hashing",
        "VERIS_DATABASE_URL": "sqlite:///:memory:",
    }
)
os.environ.pop("ANTHROPIC_API_KEY", None)

import numpy as np  # noqa: E402
import pytest  # noqa: E402

from veris.config import Settings  # noqa: E402
from veris.domain.models import ChunkInput, Paper  # noqa: E402
from veris.embeddings.hashing import HashingEmbedder  # noqa: E402
from veris.ingestion.chunker import chunk_paper  # noqa: E402
from veris.insights.clustering import choose_k  # noqa: E402
from veris.insights.graph import coauthor_edges, semantic_edges  # noqa: E402
from veris.insights.map_builder import build_map  # noqa: E402
from veris.insights.position import PositionService  # noqa: E402
from veris.insights.projection import project_2d  # noqa: E402
from veris.llm.router import LLMRouter  # noqa: E402
from veris.llm.stub_provider import StubProvider  # noqa: E402
from veris.storage.sqlite_store import SqliteStore  # noqa: E402

_PAPERS = [
    Paper(arxiv_id="1", title="Multi-Agent Reinforcement Learning with Transformers",
          abstract="Multi-agent reinforcement learning coordinates many agents using attention.",
          authors=["Alice Smith", "Bob Jones"], categories=["cs.LG", "cs.MA"]),
    Paper(arxiv_id="2", title="Cooperative Navigation via Policy Gradients",
          abstract="Agents learn cooperative navigation with policy gradient methods and rewards.",
          authors=["Alice Smith"], categories=["cs.LG", "cs.MA"]),
    Paper(arxiv_id="3", title="Retrieval-Augmented Generation for QA",
          abstract="Retrieval augmented generation combines retriever and generator to reduce hallucination.",
          authors=["Carol Lee"], categories=["cs.CL"]),
    Paper(arxiv_id="4", title="Dense Retrieval for Open-Domain Question Answering",
          abstract="Dense retrieval embeds passages and queries for open domain question answering.",
          authors=["Carol Lee", "Dan Park"], categories=["cs.CL", "cs.IR"]),
    Paper(arxiv_id="5", title="Diffusion Models for Image Synthesis",
          abstract="Diffusion models generate images from noise using iterative denoising steps.",
          authors=["Eve Kim"], categories=["cs.CV"]),
    Paper(arxiv_id="6", title="Classifier-Free Guidance in Diffusion",
          abstract="Classifier free guidance improves prompt fidelity in diffusion image generation.",
          authors=["Eve Kim", "Frank Wu"], categories=["cs.CV"]),
]


@pytest.fixture
async def store():
    s = SqliteStore(":memory:")
    await s.initialize()
    embedder = HashingEmbedder()
    for paper in _PAPERS:
        pid = await s.upsert_paper(paper)
        chunks = chunk_paper(paper)
        vecs = embedder.embed_documents([c.text for c in chunks])
        await s.replace_chunks(
            pid,
            [ChunkInput(ordinal=i, section=c.section, text=c.text, token_count=1, embedding=v)
             for i, (c, v) in enumerate(zip(chunks, vecs, strict=True))],
            model=embedder.name,
        )
    try:
        yield s
    finally:
        await s.close()


def test_choose_k_bounds():
    assert choose_k(1) == 2
    assert choose_k(6) >= 2
    assert choose_k(1000) <= 12


def test_projection_shape_and_range():
    vecs = np.random.RandomState(0).randn(10, 16).astype(np.float32)
    coords = project_2d(vecs)
    assert coords.shape == (10, 2)
    assert coords.min() >= -1e-6 and coords.max() <= 100 + 1e-6


def test_semantic_and_coauthor_edges():
    vecs = np.eye(4, dtype=np.float32)
    assert all(e.kind == "semantic" for e in semantic_edges(vecs, k=1))
    edges = coauthor_edges([["A", "B"], ["B"], ["C"], ["A"]])
    # Papers 0&1 share B; 0&3 share A.
    pairs = {(e.source, e.target) for e in edges}
    assert (0, 1) in pairs and (0, 3) in pairs


async def test_fetch_paper_vectors_one_per_paper(store):
    pvs = await store.fetch_all_paper_vectors()
    assert len(pvs) == 6
    # Mean-pooled vectors are L2-normalized.
    for pv in pvs:
        assert abs(float(np.linalg.norm(pv.vector)) - 1.0) < 1e-5


async def test_build_map_artifact(store):
    router = LLMRouter(StubProvider(), synthesis_model="claude-opus-4-8", utility_model="claude-haiku-4-5")
    artifact = await build_map(store, router, embedding_model="hashing")
    assert artifact.n_papers == 6
    assert len(artifact.nodes) == 6
    assert len(artifact.clusters) >= 2
    # Labels fall back to a real category, never the stub placeholder.
    assert all(c.label and c.label.lower() != "stub" for c in artifact.clusters)
    # Coordinates are within the scaled box.
    assert all(0 <= n.x <= 100 and 0 <= n.y <= 100 for n in artifact.nodes)
    assert artifact.edges  # at least semantic edges


async def test_position_report(store):
    svc = PositionService(StubProvider(), store, HashingEmbedder(), Settings())
    report = await svc.position(
        "A transformer policy for multi-agent reinforcement learning that improves sample "
        "efficiency on cooperative navigation tasks."
    )
    assert report.nearest, "expected nearest prior work"
    assert 0.0 <= report.novelty_score <= 1.0
    assert 0.0 <= report.density <= 1.0
    # Collaborators are aggregated from public author metadata on the nearest papers.
    assert report.collaborators
    assert all(c.profile_url.startswith("https://scholar.google.com") for c in report.collaborators)
    assert report.related_work_markdown
    assert report.citations
