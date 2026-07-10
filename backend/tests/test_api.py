"""HTTP surface smoke test via TestClient (boots the real app + lifespan)."""

from __future__ import annotations

import os

os.environ.update(
    {
        "VERIS_ENV": "development",
        "VERIS_EMBEDDING_MODEL": "hashing",
        "VERIS_DATABASE_URL": "sqlite:///:memory:",
        "VERIS_SYNTHESIS_MODEL": "claude-sonnet-5",
        # Explicit empty beats any .env file (popping does not — pydantic
        # settings would still read the key from ../.env and hit the real API)
        "ANTHROPIC_API_KEY": "",
        "HF_TOKEN": "",
        "VERIS_LLM_PROVIDER": "auto",
        "VERIS_SEED_TOPICS": "",
    }
)

from fastapi.testclient import TestClient

from veris.config import get_settings
from veris.main import app


def test_api_surface():
    get_settings.cache_clear()
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200

        stats = client.get("/v1/stats").json()
        assert stats["papers"] == 0
        assert stats["synthesis_model"] == "claude-sonnet-5"

        assert client.get("/v1/papers").json() == []

        # Ask against an empty corpus still returns a well-formed answer.
        resp = client.post("/v1/ask/sync", json={"question": "What is retrieval augmentation?"})
        assert resp.status_code == 200
        body = resp.json()
        assert "markdown" in body and "citations" in body and "plan" in body

        # Map endpoint responds on an empty corpus.
        m = client.get("/v1/map").json()
        assert "nodes" in m and "clusters" in m
