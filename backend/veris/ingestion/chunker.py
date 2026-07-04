"""Turn a paper into retrievable passages.

arXiv gives us title + abstract. We emit the title as one passage (high-signal for sparse
matching) and split the abstract into overlapping sentence windows so dense retrieval can
target the specific claim a question is about, not the whole abstract.
"""

from __future__ import annotations

import re

from veris.domain.models import Paper

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_RE.split(text) if s.strip()]


def _windows(sentences: list[str], *, target_words: int, overlap: int) -> list[str]:
    """Greedy sentence windows of ~target_words with sentence-level overlap."""
    chunks: list[str] = []
    i = 0
    while i < len(sentences):
        window: list[str] = []
        words = 0
        j = i
        while j < len(sentences) and words < target_words:
            window.append(sentences[j])
            words += len(sentences[j].split())
            j += 1
        chunks.append(" ".join(window))
        if j >= len(sentences):
            break
        i = max(i + 1, j - overlap)
    return chunks


class Chunk:
    __slots__ = ("section", "text")

    def __init__(self, section: str, text: str) -> None:
        self.section = section
        self.text = text


def chunk_paper(paper: Paper, *, target_words: int = 90, overlap: int = 1) -> list[Chunk]:
    chunks: list[Chunk] = [Chunk("title", paper.title)]
    sentences = _sentences(paper.abstract)
    if not sentences:
        return chunks
    for window in _windows(sentences, target_words=target_words, overlap=overlap):
        chunks.append(Chunk("abstract", window))
    return chunks
