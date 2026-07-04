"""Reciprocal Rank Fusion (RRF).

Dense and sparse retrieval return scores on incomparable scales, so we fuse by *rank*, not
score: each result contributes ``1 / (k + rank)`` from every list it appears in. This is the
standard, robust way to combine heterogeneous retrievers and is where most of hybrid
retrieval's quality comes from.
"""

from __future__ import annotations

from veris.domain.models import ScoredChunk


def reciprocal_rank_fusion(
    result_lists: list[list[ScoredChunk]],
    *,
    k: int = 60,
) -> list[ScoredChunk]:
    """Fuse multiple ranked lists into one, ordered by descending RRF score."""
    fused: dict[int, ScoredChunk] = {}
    scores: dict[int, float] = {}

    for results in result_lists:
        for rank, chunk in enumerate(results, start=1):
            scores[chunk.chunk_id] = scores.get(chunk.chunk_id, 0.0) + 1.0 / (k + rank)
            # Keep the first representation we saw (text + metadata are identical).
            fused.setdefault(chunk.chunk_id, chunk)

    ordered = sorted(fused.values(), key=lambda c: scores[c.chunk_id], reverse=True)
    return [
        c.model_copy(update={"score": scores[c.chunk_id], "rank": i})
        for i, c in enumerate(ordered, start=1)
    ]
