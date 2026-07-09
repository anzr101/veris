"""Assemble the Map of Science: vectors → projection → clusters → labels → artifact.

Expensive, so it's precomputed (CLI or a worker job) and persisted as JSON; the API serves
the cached artifact.
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

from veris.domain.insights import CLUSTER_PALETTE, Cluster, MapArtifact, MapNode
from veris.insights.clustering import cluster_vectors, label_clusters, representative_titles
from veris.insights.graph import coauthor_edges, semantic_edges
from veris.insights.projection import project_2d
from veris.llm.router import LLMRouter
from veris.storage.base import Store

_RESULTS_DIR = Path(__file__).parent / "results"
MAP_PATH = _RESULTS_DIR / "map.json"


def _fallback_label(categories: list[str], cid: int) -> str:
    counts = Counter(categories)
    return counts.most_common(1)[0][0] if counts else f"Cluster {cid}"


async def build_map(store: Store, router: LLMRouter, *, embedding_model: str = "") -> MapArtifact:
    pvs = await store.fetch_all_paper_vectors()
    built_at = datetime.now(UTC).isoformat()
    if not pvs:
        return MapArtifact(built_at=built_at, embedding_model=embedding_model, n_papers=0)

    vectors = np.array([p.vector for p in pvs], dtype=np.float32)
    coords = project_2d(vectors)
    labels = cluster_vectors(vectors)
    titles = [p.title for p in pvs]

    reps = representative_titles(vectors, labels, titles)
    llm_labels = await label_clusters(reps, router)

    nodes = [
        MapNode(
            paper_id=p.paper_id,
            arxiv_id=p.arxiv_id,
            title=p.title,
            x=float(coords[i, 0]),
            y=float(coords[i, 1]),
            cluster=int(labels[i]),
            year=p.year,
            categories=p.categories,
        )
        for i, p in enumerate(pvs)
    ]

    clusters: list[Cluster] = []
    for cid in sorted({int(x) for x in labels}):
        idx = [i for i in range(len(pvs)) if int(labels[i]) == cid]
        cats = [c for i in idx for c in pvs[i].categories]
        label, desc = llm_labels.get(cid, ("", ""))
        if not label or label.lower() == "stub":
            label = _fallback_label(cats, cid)
        if desc.lower() == "stub":
            desc = ""
        clusters.append(
            Cluster(
                id=cid,
                label=label,
                description=desc,
                size=len(idx),
                color=CLUSTER_PALETTE[cid % len(CLUSTER_PALETTE)],
                x=float(np.mean([coords[i, 0] for i in idx])),
                y=float(np.mean([coords[i, 1] for i in idx])),
            )
        )

    edges = semantic_edges(vectors, k=3) + coauthor_edges([p.authors for p in pvs])

    return MapArtifact(
        built_at=built_at,
        embedding_model=embedding_model,
        n_papers=len(pvs),
        nodes=nodes,
        clusters=clusters,
        edges=edges,
    )


def save_map(artifact: MapArtifact) -> None:
    _RESULTS_DIR.mkdir(exist_ok=True)
    MAP_PATH.write_text(artifact.model_dump_json(), encoding="utf-8")


def load_map() -> MapArtifact | None:
    if not MAP_PATH.exists():
        return None
    return MapArtifact.model_validate(json.loads(MAP_PATH.read_text(encoding="utf-8")))
