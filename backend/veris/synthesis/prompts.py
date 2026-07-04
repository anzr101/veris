"""Prompt construction for planning and synthesis.

The synthesis prompt is the contract that makes Veris faithful: the model is told to use
**only** the numbered passages and to cite every sentence with ``[n]`` markers. Outside
knowledge is explicitly forbidden, and "not in the sources" is an allowed answer.
"""

from __future__ import annotations

from veris.domain.models import ScoredChunk

PLANNER_SYSTEM = (
    "You are a research librarian. Decompose the user's question into 2-4 focused search "
    "sub-queries that, together, would retrieve the evidence needed to answer it. Identify "
    "the intent. Return only the structured object."
)

SYNTHESIS_SYSTEM = (
    "You are a meticulous research analyst. Answer the question using ONLY the numbered "
    "passages provided. Every sentence that states a fact MUST end with one or more citation "
    "markers like [1] or [2][5], referring to the passages you used. Do not use any outside "
    "knowledge. If the passages do not contain enough information to answer, say so plainly "
    "and explain what is missing. Be precise, neutral, and concise. Where sources disagree, "
    "say so explicitly. Write in clear Markdown. Use plain punctuation; do not use em dashes."
)


def format_passages(chunks: list[ScoredChunk]) -> str:
    """Render retrieved chunks as a numbered evidence block for the synthesis prompt."""
    lines: list[str] = []
    for i, c in enumerate(chunks, start=1):
        lines.append(f"[{i}] ({c.arxiv_id} — {c.paper_title})\n{c.text}")
    return "\n\n".join(lines)


def build_synthesis_prompt(question: str, chunks: list[ScoredChunk]) -> str:
    passages = format_passages(chunks)
    return (
        f"Question:\n{question}\n\n"
        f"Evidence passages:\n{passages}\n\n"
        "Write a grounded answer. Cite every factual sentence with [n] markers that point to "
        "the passages above. Use only these passages."
    )


def build_planner_prompt(question: str) -> str:
    return f"Question:\n{question}\n\nReturn the search plan."
