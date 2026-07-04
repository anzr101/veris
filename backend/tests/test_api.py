"""HTTP surface smoke test via TestClient (boots the real app + lifespan)."""

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

from fastapi.testclient import TestClient  # noqa: E402

from veris.config import get_settings  # noqa: E402
from veris.main import app  # noqa: E402


def test_api_surface():
    get_settings.cache_clear()
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200

        stats = client.get("/v1/stats").json()
        assert stats["papers"] == 0
        assert stats["synthesis_model"] == "claude-opus-4-8"

        assert client.get("/v1/papers").json() == []

        evals = client.get("/v1/evals").json()
        assert "aggregate" in evals

        # Ask against an empty corpus still returns a well-formed answer.
        resp = client.post("/v1/ask/sync", json={"question": "What is retrieval augmentation?"})
        assert resp.status_code == 200
        body = resp.json()
        assert "markdown" in body and "citations" in body and "plan" in body

        # Map + Position endpoints respond on an empty corpus.
        m = client.get("/v1/map").json()
        assert "nodes" in m and "clusters" in m

        pos = client.post(
            "/v1/position",
            json={"text": "A method for retrieval-augmented generation that reduces hallucination."},
        )
        assert pos.status_code == 200
        assert "novelty_score" in pos.json() and "collaborators" in pos.json()
