"""Select an embedder implementation from settings."""

from __future__ import annotations

from veris.config import Settings
from veris.embeddings.base import Embedder


def build_embedder(settings: Settings) -> Embedder:
    """Return the configured embedder.

    ``VERIS_EMBEDDING_MODEL=hashing`` selects the deterministic test embedder; any other
    value is treated as a fastembed model name.
    """
    if settings.embedding_model.lower() == "hashing":
        from veris.embeddings.hashing import HashingEmbedder

        return HashingEmbedder()

    from veris.embeddings.fastembed_embedder import FastEmbedEmbedder

    return FastEmbedEmbedder(settings.embedding_model)
