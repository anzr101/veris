"""Cluster paper vectors into topic regions and label them with a cheap LLM call."""

from __future__ import annotations

import asyncio
import json
import math

import numpy as np
from sklearn.cluster import KMeans

from veris.llm.router import LLMRouter
from veris.llm.types import ModelTier

_LABEL_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {"type": "string"},
        "description": {"type": "string"},
    },
    "required": ["label", "description"],
    "additionalProperties": False,
}

_LABEL_SYSTEM = (
    "You label clusters of research papers. Given a list of paper titles from one cluster, "
    "return a concise topic label (2-4 words, Title Case) and a one-sentence description of "
    "what unites them."
)


def choose_k(n: int) -> int:
    """Heuristic cluster count: ~sqrt(n/2), clamped to [2, 12] and never exceeding n."""
    k = round(math.sqrt(max(n, 1) / 2))
    return max(2, min(12, min(k, n)))


def cluster_vectors(vectors: np.ndarray, k: int | None = None) -> np.ndarray:
    """Return an (N,) array of integer cluster labels."""
    n = vectors.shape[0]
    if n <= 2:
        return np.zeros(n, dtype=int)
    k = k or choose_k(n)
    model = KMeans(n_clusters=k, n_init=10, random_state=42)
    return np.asarray(model.fit_predict(vectors))


def representative_titles(
    vectors: np.ndarray, labels: np.ndarray, titles: list[str], *, per_cluster: int = 8
) -> dict[int, list[str]]:
    """For each cluster, the titles closest to its centroid (vectors are normalized)."""
    reps: dict[int, list[str]] = {}
    for cid in sorted(set(int(x) for x in labels)):
        idx = np.where(labels == cid)[0]
        centroid = vectors[idx].mean(axis=0)
        sims = vectors[idx] @ centroid
        top = idx[np.argsort(-sims)[:per_cluster]]
        reps[cid] = [titles[i] for i in top]
    return reps


async def label_clusters(
    reps: dict[int, list[str]], router: LLMRouter
) -> dict[int, tuple[str, str]]:
    """Label every cluster concurrently with UTILITY-tier (Haiku) calls."""

    async def _one(cid: int, titles: list[str]) -> tuple[int, tuple[str, str]]:
        prompt = "Titles in this cluster:\n" + "\n".join(f"- {t}" for t in titles)
        try:
            result = await router.complete(
                ModelTier.UTILITY,
                prompt=prompt,
                system=_LABEL_SYSTEM,
                stage="cluster_label",
                max_tokens=120,
                json_schema=_LABEL_SCHEMA,
            )
            data = json.loads(result.text)
            label = str(data.get("label", "")).strip()
            description = str(data.get("description", "")).strip()
            return cid, (label, description)
        except Exception:
            # LLM unavailable (no key, no credit, outage) or bad JSON —
            # the map must still render; category fallback fills the label.
            return cid, ("", "")

    pairs = await asyncio.gather(*(_one(cid, titles) for cid, titles in reps.items()))
    return dict(pairs)
