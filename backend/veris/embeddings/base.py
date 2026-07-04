"""Embedder port. Adapters turn text into normalized dense vectors."""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class Embedder(Protocol):
    """Produces L2-normalized embeddings so cosine similarity == dot product."""

    @property
    def dim(self) -> int:
        """Embedding dimensionality."""
        ...

    @property
    def name(self) -> str:
        """Identifier persisted alongside vectors (so we can re-embed safely)."""
        ...

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of passages."""
        ...

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query."""
        ...
