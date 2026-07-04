"""Independent grounding: decompose the answer into claims, verify each against evidence.

The model that *writes* the answer is not trusted to *grade* it. A separate UTILITY-tier
pass decomposes the answer into atomic claims and, for each, checks whether the cited
passages actually entail it — flagging unsupported claims. This is the heart of Veris'
faithfulness guarantee.
"""

from __future__ import annotations

import json

from veris.domain.answer import ClaimVerification, Contradiction
from veris.domain.models import ScoredChunk
from veris.llm.router import LLMRouter
from veris.llm.types import ModelTier
from veris.synthesis.prompts import format_passages

_CLAIMS_SCHEMA = {
    "type": "object",
    "properties": {
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "citation_indices": {"type": "array", "items": {"type": "integer"}},
                    "status": {
                        "type": "string",
                        "enum": ["supported", "partial", "unsupported"],
                    },
                    "confidence": {"type": "number"},
                    "rationale": {"type": "string"},
                },
                "required": ["claim", "status", "confidence"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["claims"],
    "additionalProperties": False,
}

_CONTRADICTION_SCHEMA = {
    "type": "object",
    "properties": {
        "contradictions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "summary": {"type": "string"},
                    "arxiv_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["topic", "summary"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["contradictions"],
    "additionalProperties": False,
}

_VERIFY_SYSTEM = (
    "You are a fact-checking verifier. You are given an answer and the numbered evidence "
    "passages it was supposed to be based on. Decompose the answer into atomic factual "
    "claims. For each claim, decide whether the cited passages ENTAIL it: 'supported' (fully "
    "entailed), 'partial' (partially supported), or 'unsupported' (not entailed by any "
    "passage). Give a confidence in [0,1] and a one-line rationale. Be strict — if the "
    "evidence does not clearly state it, it is not supported."
)

_CONTRADICTION_SYSTEM = (
    "You analyze a set of research passages and identify points where the sources genuinely "
    "DISAGREE (conflicting findings, opposite conclusions, incompatible claims). Only report "
    "real contradictions grounded in the passages, with the arxiv ids involved. If there are "
    "none, return an empty list."
)


class Grounder:
    def __init__(self, router: LLMRouter) -> None:
        self._router = router

    async def verify(
        self, answer_markdown: str, chunks: list[ScoredChunk]
    ) -> list[ClaimVerification]:
        passages = format_passages(chunks)
        prompt = (
            f"Answer to verify:\n{answer_markdown}\n\n"
            f"Evidence passages:\n{passages}\n\n"
            "Decompose into atomic claims and verify each against the passages."
        )
        result = await self._router.complete(
            ModelTier.UTILITY,
            prompt=prompt,
            system=_VERIFY_SYSTEM,
            stage="verify",
            max_tokens=1500,
            json_schema=_CLAIMS_SCHEMA,
        )
        return _parse_claims(result.text)

    async def find_contradictions(
        self, chunks: list[ScoredChunk]
    ) -> list[Contradiction]:
        passages = format_passages(chunks)
        result = await self._router.complete(
            ModelTier.UTILITY,
            prompt=f"Passages:\n{passages}\n\nIdentify genuine contradictions.",
            system=_CONTRADICTION_SYSTEM,
            stage="contradictions",
            max_tokens=800,
            json_schema=_CONTRADICTION_SCHEMA,
        )
        return _parse_contradictions(result.text)


def _parse_claims(text: str) -> list[ClaimVerification]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    out: list[ClaimVerification] = []
    for c in data.get("claims", []):
        try:
            out.append(
                ClaimVerification(
                    claim=c["claim"],
                    citation_indices=c.get("citation_indices", []),
                    status=c.get("status", "supported"),
                    confidence=float(c.get("confidence", 0.0)),
                    rationale=c.get("rationale", ""),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return out


def _parse_contradictions(text: str) -> list[Contradiction]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    out: list[Contradiction] = []
    for c in data.get("contradictions", []):
        try:
            out.append(
                Contradiction(
                    topic=c["topic"],
                    summary=c["summary"],
                    arxiv_ids=c.get("arxiv_ids", []),
                )
            )
        except (KeyError, TypeError):
            continue
    return out
