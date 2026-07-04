"""Local ONNX embedder via fastembed (no GPU, no per-call API cost).

The model is downloaded and cached on first use. Imported lazily so that environments
which only need the hashing embedder (tests, CI) don't pay the import cost.
"""

from __future__ import annotations

import os
from functools import cached_property

# Windows blocks the symlinks HuggingFace uses for its cache unless Developer Mode is on
# (WinError 1314). Force plain file copies so the model download works for everyone.
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


class FastEmbedEmbedder:
    # bge-small-en-v1.5 emits 384-dim vectors; kept as a constant to avoid a model
    # round-trip just to learn the dimensionality.
    _KNOWN_DIMS = {
        "BAAI/bge-small-en-v1.5": 384,
        "BAAI/bge-base-en-v1.5": 768,
    }

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5") -> None:
        self._model_name = model_name

    @cached_property
    def _model(self):  # type: ignore[no-untyped-def]
        from fastembed import TextEmbedding

        return TextEmbedding(model_name=self._model_name)

    @property
    def dim(self) -> int:
        return self._KNOWN_DIMS.get(self._model_name, 384)

    @property
    def name(self) -> str:
        return self._model_name

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        # fastembed returns normalized vectors as numpy arrays.
        return [v.tolist() for v in self._model.embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return next(iter(self._model.query_embed(text))).tolist()
