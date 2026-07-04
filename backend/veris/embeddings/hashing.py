"""Dependency-free, deterministic embedder.

Used in tests and CI so the suite never downloads a model or needs a GPU. It is a hashed
bag-of-words projection: not semantically strong, but stable and good enough to exercise
the retrieval/fusion plumbing deterministically.
"""

from __future__ import annotations

import hashlib
import math
import re

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class HashingEmbedder:
    def __init__(self, dim: int = 384) -> None:
        self._dim = dim

    @property
    def dim(self) -> int:
        return self._dim

    @property
    def name(self) -> str:
        return f"hashing-{self._dim}"

    def _embed(self, text: str) -> list[float]:
        vec = [0.0] * self._dim
        for token in _TOKEN_RE.findall(text.lower()):
            h = hashlib.blake2b(token.encode(), digest_size=8).digest()
            idx = int.from_bytes(h[:4], "big") % self._dim
            sign = 1.0 if h[4] & 1 else -1.0
            vec[idx] += sign
        norm = math.sqrt(sum(v * v for v in vec))
        if norm == 0.0:
            return vec
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)
