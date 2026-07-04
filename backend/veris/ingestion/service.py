"""Ingestion orchestration: fetch → chunk → embed → store."""

from __future__ import annotations

from dataclasses import dataclass

from veris.core.logging import get_logger
from veris.domain.models import ChunkInput
from veris.embeddings.base import Embedder
from veris.ingestion.arxiv_client import ArxivClient
from veris.ingestion.chunker import chunk_paper
from veris.storage.base import Store

_log = get_logger("veris.ingestion")

# Default seed: AI / ML / NLP, matching the product's target audience.
DEFAULT_CATEGORIES = ("cs.LG", "cs.CL", "cs.AI")


@dataclass
class IngestStats:
    papers: int
    chunks: int


def build_query(terms: str | None, categories: tuple[str, ...]) -> str:
    cat_clause = " OR ".join(f"cat:{c}" for c in categories)
    if terms:
        return f"({cat_clause}) AND all:{terms}"
    return cat_clause


class IngestionService:
    def __init__(self, client: ArxivClient, embedder: Embedder, store: Store) -> None:
        self._client = client
        self._embedder = embedder
        self._store = store

    async def ingest(
        self,
        terms: str | None = None,
        *,
        categories: tuple[str, ...] = DEFAULT_CATEGORIES,
        max_results: int = 50,
    ) -> IngestStats:
        query = build_query(terms, categories)
        papers = await self._client.search(query, max_results=max_results)

        total_chunks = 0
        for paper in papers:
            paper_id = await self._store.upsert_paper(paper)
            chunks = chunk_paper(paper)
            vectors = self._embedder.embed_documents([c.text for c in chunks])
            chunk_inputs = [
                ChunkInput(
                    ordinal=i,
                    section=c.section,
                    text=c.text,
                    token_count=len(c.text.split()),
                    embedding=vec,
                )
                for i, (c, vec) in enumerate(zip(chunks, vectors, strict=True))
            ]
            written = await self._store.replace_chunks(
                paper_id, chunk_inputs, model=self._embedder.name
            )
            total_chunks += written

        _log.info("ingest.done", papers=len(papers), chunks=total_chunks)
        return IngestStats(papers=len(papers), chunks=total_chunks)
