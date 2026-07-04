"""Edges for the map: semantic kNN (concept proximity) and co-authorship (collaboration)."""

from __future__ import annotations

import numpy as np

from veris.domain.insights import MapEdge


def semantic_edges(vectors: np.ndarray, *, k: int = 3) -> list[MapEdge]:
    """Undirected kNN edges by cosine similarity (vectors are L2-normalized)."""
    n = vectors.shape[0]
    if n < 2:
        return []
    sims = vectors @ vectors.T
    np.fill_diagonal(sims, -np.inf)
    seen: set[tuple[int, int]] = set()
    edges: list[MapEdge] = []
    kk = min(k, n - 1)
    for i in range(n):
        for j in np.argsort(-sims[i])[:kk]:
            a, b = sorted((i, int(j)))
            if (a, b) in seen:
                continue
            seen.add((a, b))
            edges.append(MapEdge(source=a, target=b, weight=float(sims[i, j]), kind="semantic"))
    return edges


def coauthor_edges(authors_per_paper: list[list[str]], *, max_edges: int = 600) -> list[MapEdge]:
    """Connect papers that share at least one author; weight = shared-author count."""
    index: dict[str, list[int]] = {}
    for i, authors in enumerate(authors_per_paper):
        for a in authors:
            key = a.strip().lower()
            if key:
                index.setdefault(key, []).append(i)

    weights: dict[tuple[int, int], int] = {}
    for papers in index.values():
        if len(papers) < 2:
            continue
        for x in range(len(papers)):
            for y in range(x + 1, len(papers)):
                a, b = sorted((papers[x], papers[y]))
                weights[(a, b)] = weights.get((a, b), 0) + 1

    ranked = sorted(weights.items(), key=lambda kv: kv[1], reverse=True)[:max_edges]
    return [MapEdge(source=a, target=b, weight=float(w), kind="coauthor") for (a, b), w in ranked]
