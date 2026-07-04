"""Faithfulness-oriented metrics computed over a generated Answer.

These are deterministic, no-extra-LLM-call metrics derived from the grounding output and the
answer text — the kind of measurable signal that gates prompt/retrieval changes in CI.
"""

from __future__ import annotations

import re

from veris.domain.answer import Answer

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")
_CITATION_RE = re.compile(r"\[\d+\]")


def citation_coverage(markdown: str) -> float:
    """Fraction of factual sentences carrying at least one ``[n]`` citation marker."""
    sentences = [s for s in _SENTENCE_RE.split(markdown) if len(s.split()) >= 4]
    if not sentences:
        return 0.0
    cited = sum(1 for s in sentences if _CITATION_RE.search(s))
    return cited / len(sentences)


def grounded_claim_rate(answer: Answer) -> float:
    """Fraction of verified claims that point at ≥1 citation."""
    if not answer.claims:
        return 1.0
    grounded = sum(1 for c in answer.claims if c.citation_indices)
    return grounded / len(answer.claims)


def score_answer(answer: Answer) -> dict[str, float]:
    return {
        "faithfulness": round(answer.faithfulness, 3),
        "citation_coverage": round(citation_coverage(answer.markdown), 3),
        "grounded_claim_rate": round(grounded_claim_rate(answer), 3),
        "n_citations": float(len(answer.citations)),
        "n_claims": float(len(answer.claims)),
        "n_contradictions": float(len(answer.contradictions)),
    }


def aggregate(per_question: list[dict[str, float]]) -> dict[str, float]:
    if not per_question:
        return {}
    keys = per_question[0].keys()
    return {k: round(sum(q[k] for q in per_question) / len(per_question), 3) for k in keys}
