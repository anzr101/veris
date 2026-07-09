"""Postgres + pgvector storage adapter — the production backend.

Mirrors :class:`SqliteStore` behavior through the same ``Store`` port, but pushes the work
into Postgres: dense retrieval via a pgvector HNSW index (cosine), sparse retrieval via a
generated ``tsvector`` column with a GIN index (BM25-style ``ts_rank``). RRF fusion stays in
the retriever, so dense and sparse are returned as independent ranked lists, exactly like
the SQLite adapter. Not exercised in the offline test suite (needs a running Postgres); it
comes up under docker-compose with ``VERIS_ENV=production``.
"""

from __future__ import annotations

import json
from typing import Any

import asyncpg
import numpy as np
from pgvector.asyncpg import register_vector

from veris.domain.insights import PaperVector
from veris.domain.models import ChunkInput, Paper, RetrievalFilters, ScoredChunk

_DEFAULT_DIM = 384  # bge-small-en-v1.5 (and the hashing fallback)

_SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS papers (
    id           SERIAL PRIMARY KEY,
    arxiv_id     TEXT NOT NULL UNIQUE,
    title        TEXT NOT NULL,
    abstract     TEXT NOT NULL,
    authors      JSONB NOT NULL DEFAULT '[]',
    categories   JSONB NOT NULL DEFAULT '[]',
    published_at TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ,
    pdf_url      TEXT,
    raw_meta     JSONB NOT NULL DEFAULT '{{}}'
);
CREATE INDEX IF NOT EXISTS idx_papers_published ON papers (published_at DESC);

CREATE TABLE IF NOT EXISTS chunks (
    id          SERIAL PRIMARY KEY,
    paper_id    INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    ordinal     INTEGER NOT NULL,
    section     TEXT NOT NULL DEFAULT '',
    text        TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    tsv         TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
CREATE INDEX IF NOT EXISTS idx_chunks_paper ON chunks (paper_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON chunks USING GIN (tsv);

CREATE TABLE IF NOT EXISTS chunk_embeddings (
    chunk_id  INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
    model     TEXT NOT NULL,
    embedding VECTOR({dim})
);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_hnsw
    ON chunk_embeddings USING hnsw (embedding vector_cosine_ops);
"""


def _dsn(database_url: str) -> str:
    # SQLAlchemy-style "postgresql+asyncpg://..." -> asyncpg "postgresql://..."
    return database_url.replace("+asyncpg", "")


class PostgresStore:
    def __init__(self, database_url: str, *, embedding_dim: int = _DEFAULT_DIM) -> None:
        self._dsn = _dsn(database_url)
        self._dim = embedding_dim
        self._pool: asyncpg.Pool | None = None

    @property
    def _p(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("PostgresStore not initialized; call initialize() first.")
        return self._pool

    async def initialize(self) -> None:
        async def _init(conn: asyncpg.Connection) -> None:
            await register_vector(conn)

        # The vector extension must exist before register_vector can introspect the type,
        # so create the schema on a bootstrap connection first.
        boot = await asyncpg.connect(self._dsn)
        try:
            await boot.execute(_SCHEMA.format(dim=self._dim))
        finally:
            await boot.close()
        self._pool = await asyncpg.create_pool(self._dsn, init=_init)

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    # ── writes ────────────────────────────────────────────────────────────────────────

    async def upsert_paper(self, paper: Paper) -> int:
        row = await self._p.fetchrow(
            """
            INSERT INTO papers (arxiv_id, title, abstract, authors, categories,
                                published_at, updated_at, pdf_url, raw_meta)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (arxiv_id) DO UPDATE SET
                title=EXCLUDED.title, abstract=EXCLUDED.abstract, authors=EXCLUDED.authors,
                categories=EXCLUDED.categories, published_at=EXCLUDED.published_at,
                updated_at=EXCLUDED.updated_at, pdf_url=EXCLUDED.pdf_url,
                raw_meta=EXCLUDED.raw_meta
            RETURNING id
            """,
            paper.arxiv_id, paper.title, paper.abstract,
            json.dumps(paper.authors), json.dumps(paper.categories),
            paper.published_at, paper.updated_at, paper.pdf_url, json.dumps(paper.raw_meta),
        )
        return int(row["id"])

    async def get_paper_by_arxiv_id(self, arxiv_id: str) -> Paper | None:
        row = await self._p.fetchrow("SELECT * FROM papers WHERE arxiv_id=$1", arxiv_id)
        return _row_to_paper(row) if row else None

    async def list_papers(self, *, limit: int = 50, offset: int = 0) -> list[Paper]:
        rows = await self._p.fetch(
            "SELECT * FROM papers ORDER BY published_at DESC NULLS LAST, id DESC "
            "LIMIT $1 OFFSET $2",
            limit, offset,
        )
        return [_row_to_paper(r) for r in rows]

    async def replace_chunks(
        self, paper_id: int, chunks: list[ChunkInput], *, model: str
    ) -> int:
        async with self._p.acquire() as conn, conn.transaction():
            await conn.execute("DELETE FROM chunks WHERE paper_id=$1", paper_id)
            for ch in chunks:
                chunk_id = await conn.fetchval(
                    "INSERT INTO chunks (paper_id, ordinal, section, text, token_count) "
                    "VALUES ($1,$2,$3,$4,$5) RETURNING id",
                    paper_id, ch.ordinal, ch.section, ch.text, ch.token_count,
                )
                await conn.execute(
                    "INSERT INTO chunk_embeddings (chunk_id, model, embedding) "
                    "VALUES ($1,$2,$3)",
                    chunk_id, model, list(ch.embedding),
                )
        return len(chunks)

    # ── reads ─────────────────────────────────────────────────────────────────────────

    async def dense_search(
        self, query_vec: list[float], top_k: int, filters: RetrievalFilters | None = None
    ) -> list[ScoredChunk]:
        where, args = _filter_sql(filters, start=2)
        rows = await self._p.fetch(
            f"""
            SELECT c.id, c.paper_id, c.ordinal, c.section, c.text,
                   p.arxiv_id, p.title,
                   1 - (e.embedding <=> $1) AS score
            FROM chunk_embeddings e
            JOIN chunks c ON c.id = e.chunk_id
            JOIN papers p ON p.id = c.paper_id
            {where}
            ORDER BY e.embedding <=> $1
            LIMIT {top_k}
            """,
            list(query_vec), *args,
        )
        return [_row_to_scored(r, i) for i, r in enumerate(rows, 1)]

    async def sparse_search(
        self, query_text: str, top_k: int, filters: RetrievalFilters | None = None
    ) -> list[ScoredChunk]:
        where, args = _filter_sql(filters, start=2, base="c.tsv @@ plainto_tsquery('english',$1)")
        rows = await self._p.fetch(
            f"""
            SELECT c.id, c.paper_id, c.ordinal, c.section, c.text,
                   p.arxiv_id, p.title,
                   ts_rank(c.tsv, plainto_tsquery('english',$1)) AS score
            FROM chunks c JOIN papers p ON p.id = c.paper_id
            {where}
            ORDER BY score DESC
            LIMIT {top_k}
            """,
            query_text, *args,
        )
        return [_row_to_scored(r, i) for i, r in enumerate(rows, 1)]

    async def fetch_all_paper_vectors(self) -> list[PaperVector]:
        rows = await self._p.fetch(
            """
            SELECT c.paper_id, e.embedding, p.arxiv_id, p.title, p.categories,
                   p.authors, p.published_at
            FROM chunk_embeddings e
            JOIN chunks c ON c.id = e.chunk_id
            JOIN papers p ON p.id = c.paper_id
            """
        )
        grouped: dict[int, dict[str, Any]] = {}
        for row in rows:
            pid = int(row["paper_id"])
            entry = grouped.setdefault(
                pid,
                {
                    "arxiv_id": row["arxiv_id"],
                    "title": row["title"],
                    "categories": json.loads(row["categories"]),
                    "authors": json.loads(row["authors"]),
                    "published_at": row["published_at"],
                    "vectors": [],
                },
            )
            entry["vectors"].append(np.asarray(row["embedding"], dtype=np.float32))

        out: list[PaperVector] = []
        for pid, e in grouped.items():
            mean = np.stack(e["vectors"]).mean(axis=0)
            norm = float(np.linalg.norm(mean))
            if norm > 0:
                mean = mean / norm
            published = e["published_at"]
            out.append(
                PaperVector(
                    paper_id=pid,
                    arxiv_id=e["arxiv_id"],
                    title=e["title"],
                    categories=e["categories"],
                    authors=e["authors"],
                    year=published.year if published else None,
                    vector=mean.astype(float).tolist(),
                )
            )
        return out

    async def count_papers(self) -> int:
        return int(await self._p.fetchval("SELECT COUNT(*) FROM papers"))

    async def count_chunks(self) -> int:
        return int(await self._p.fetchval("SELECT COUNT(*) FROM chunks"))


def _filter_sql(
    filters: RetrievalFilters | None, *, start: int, base: str = ""
) -> tuple[str, list[Any]]:
    clauses: list[str] = [base] if base else []
    args: list[Any] = []
    n = start
    if filters and filters.categories:
        clauses.append(f"p.categories ?| ${n}::text[]")
        args.append(list(filters.categories))
        n += 1
    if filters and filters.published_after:
        clauses.append(f"p.published_at >= ${n}")
        args.append(filters.published_after)
        n += 1
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, args


def _row_to_scored(row: asyncpg.Record, rank: int) -> ScoredChunk:
    return ScoredChunk(
        chunk_id=row["id"],
        paper_id=row["paper_id"],
        arxiv_id=row["arxiv_id"],
        paper_title=row["title"],
        ordinal=row["ordinal"],
        section=row["section"],
        text=row["text"],
        score=float(row["score"]),
        rank=rank,
    )


def _row_to_paper(row: asyncpg.Record) -> Paper:
    return Paper(
        arxiv_id=row["arxiv_id"],
        title=row["title"],
        abstract=row["abstract"],
        authors=json.loads(row["authors"]),
        categories=json.loads(row["categories"]),
        published_at=row["published_at"],
        updated_at=row["updated_at"],
        pdf_url=row["pdf_url"],
        raw_meta=json.loads(row["raw_meta"]),
    )
