"""SQLite storage adapter — the zero-infrastructure dev backend.

Dense retrieval: embeddings are stored as float32 blobs and scored with NumPy cosine
similarity (vectors are pre-normalized, so cosine == dot product). Sparse retrieval: the
built-in **FTS5** virtual table provides real BM25 ranking. Category/date filters are
applied in Python after candidate fetch, which keeps the SQL trivial at dev-corpus scale.
"""

from __future__ import annotations

import json
from datetime import datetime

import aiosqlite
import numpy as np

from veris.domain.insights import PaperVector
from veris.domain.models import ChunkInput, Paper, RetrievalFilters, ScoredChunk

_SCHEMA = """
CREATE TABLE IF NOT EXISTS papers (
    id           INTEGER PRIMARY KEY,
    arxiv_id     TEXT NOT NULL UNIQUE,
    title        TEXT NOT NULL,
    abstract     TEXT NOT NULL,
    authors      TEXT NOT NULL DEFAULT '[]',
    categories   TEXT NOT NULL DEFAULT '[]',
    published_at TEXT,
    updated_at   TEXT,
    pdf_url      TEXT,
    raw_meta     TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS chunks (
    id          INTEGER PRIMARY KEY,
    paper_id    INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    ordinal     INTEGER NOT NULL,
    section     TEXT NOT NULL DEFAULT '',
    text        TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    embedding   BLOB NOT NULL,
    embed_model TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_paper ON chunks(paper_id);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(text);
"""


def _to_iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _from_iso(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


class SqliteStore:
    def __init__(self, path: str) -> None:
        self._path = path
        self._db: aiosqlite.Connection | None = None

    @property
    def _conn(self) -> aiosqlite.Connection:
        if self._db is None:
            raise RuntimeError("SqliteStore not initialized; call initialize() first.")
        return self._db

    async def initialize(self) -> None:
        self._db = await aiosqlite.connect(self._path)
        self._db.row_factory = aiosqlite.Row
        await self._db.execute("PRAGMA foreign_keys = ON")
        try:
            await self._db.executescript(_SCHEMA)
        except aiosqlite.OperationalError as exc:  # pragma: no cover - env dependent
            raise RuntimeError(
                "SQLite was built without FTS5; sparse retrieval is unavailable. "
                "Use a Python build with FTS5, or run the Postgres backend."
            ) from exc
        await self._db.commit()

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None

    # ── writes ────────────────────────────────────────────────────────────────────────

    async def upsert_paper(self, paper: Paper) -> int:
        await self._conn.execute(
            """
            INSERT INTO papers (arxiv_id, title, abstract, authors, categories,
                                published_at, updated_at, pdf_url, raw_meta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(arxiv_id) DO UPDATE SET
                title=excluded.title, abstract=excluded.abstract, authors=excluded.authors,
                categories=excluded.categories, published_at=excluded.published_at,
                updated_at=excluded.updated_at, pdf_url=excluded.pdf_url,
                raw_meta=excluded.raw_meta
            """,
            (
                paper.arxiv_id,
                paper.title,
                paper.abstract,
                json.dumps(paper.authors),
                json.dumps(paper.categories),
                _to_iso(paper.published_at),
                _to_iso(paper.updated_at),
                paper.pdf_url,
                json.dumps(paper.raw_meta),
            ),
        )
        await self._conn.commit()
        async with self._conn.execute(
            "SELECT id FROM papers WHERE arxiv_id = ?", (paper.arxiv_id,)
        ) as cur:
            row = await cur.fetchone()
        assert row is not None
        return int(row["id"])

    async def get_paper_by_arxiv_id(self, arxiv_id: str) -> Paper | None:
        async with self._conn.execute(
            "SELECT * FROM papers WHERE arxiv_id = ?", (arxiv_id,)
        ) as cur:
            row = await cur.fetchone()
        return self._row_to_paper(row) if row else None

    async def list_papers(self, *, limit: int = 50, offset: int = 0) -> list[Paper]:
        async with self._conn.execute(
            "SELECT * FROM papers ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ) as cur:
            rows = await cur.fetchall()
        return [self._row_to_paper(r) for r in rows]

    async def replace_chunks(
        self, paper_id: int, chunks: list[ChunkInput], *, model: str
    ) -> int:
        # Remove existing chunks (and their FTS rows) for idempotent re-ingest.
        async with self._conn.execute(
            "SELECT id FROM chunks WHERE paper_id = ?", (paper_id,)
        ) as cur:
            old_ids = [r["id"] for r in await cur.fetchall()]
        if old_ids:
            await self._conn.executemany(
                "DELETE FROM chunks_fts WHERE rowid = ?", [(i,) for i in old_ids]
            )
            await self._conn.execute("DELETE FROM chunks WHERE paper_id = ?", (paper_id,))

        for ch in chunks:
            blob = np.asarray(ch.embedding, dtype=np.float32).tobytes()
            cur = await self._conn.execute(
                """
                INSERT INTO chunks (paper_id, ordinal, section, text, token_count,
                                    embedding, embed_model)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (paper_id, ch.ordinal, ch.section, ch.text, ch.token_count, blob, model),
            )
            await self._conn.execute(
                "INSERT INTO chunks_fts (rowid, text) VALUES (?, ?)",
                (cur.lastrowid, ch.text),
            )
        await self._conn.commit()
        return len(chunks)

    # ── reads ─────────────────────────────────────────────────────────────────────────

    async def dense_search(
        self,
        query_vec: list[float],
        top_k: int,
        filters: RetrievalFilters | None = None,
    ) -> list[ScoredChunk]:
        rows = await self._fetch_candidate_chunks(filters)
        if not rows:
            return []
        matrix = np.stack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
        q = np.asarray(query_vec, dtype=np.float32)
        scores = matrix @ q  # cosine: both sides normalized
        order = np.argsort(-scores)[:top_k]
        results: list[ScoredChunk] = []
        for rank, idx in enumerate(order, start=1):
            results.append(self._row_to_scored(rows[int(idx)], float(scores[idx]), rank))
        return results

    async def sparse_search(
        self,
        query_text: str,
        top_k: int,
        filters: RetrievalFilters | None = None,
    ) -> list[ScoredChunk]:
        match = _to_fts_match(query_text)
        if not match:
            return []
        # bm25() returns lower = more relevant; negate to a positive "score".
        sql = """
            SELECT c.id, c.paper_id, c.ordinal, c.section, c.text,
                   p.arxiv_id, p.title, p.categories, p.published_at,
                   bm25(chunks_fts) AS bm25
            FROM chunks_fts
            JOIN chunks c ON c.id = chunks_fts.rowid
            JOIN papers p ON p.id = c.paper_id
            WHERE chunks_fts MATCH ?
            ORDER BY bm25 ASC
            LIMIT ?
        """
        # Over-fetch then apply Python-side filters to preserve ranking.
        limit = top_k * 5 if filters and not filters.is_empty else top_k
        async with self._conn.execute(sql, (match, limit)) as cur:
            rows = await cur.fetchall()
        results: list[ScoredChunk] = []
        for row in rows:
            if not _row_passes(row, filters):
                continue
            results.append(self._row_to_scored(row, -float(row["bm25"]), len(results) + 1))
            if len(results) >= top_k:
                break
        return results

    async def fetch_all_paper_vectors(self) -> list[PaperVector]:
        sql = """
            SELECT c.paper_id, c.embedding, p.arxiv_id, p.title, p.categories,
                   p.authors, p.published_at
            FROM chunks c JOIN papers p ON p.id = c.paper_id
        """
        async with self._conn.execute(sql) as cur:
            rows = await cur.fetchall()

        grouped: dict[int, dict] = {}
        for row in rows:
            pid = int(row["paper_id"])
            entry = grouped.setdefault(
                pid,
                {
                    "arxiv_id": row["arxiv_id"],
                    "title": row["title"],
                    "categories": json.loads(row["categories"]),
                    "authors": json.loads(row["authors"]),
                    "published_at": _from_iso(row["published_at"]),
                    "vectors": [],
                },
            )
            entry["vectors"].append(np.frombuffer(row["embedding"], dtype=np.float32))

        return [_to_paper_vector(pid, e) for pid, e in grouped.items()]

    async def count_papers(self) -> int:
        async with self._conn.execute("SELECT COUNT(*) AS n FROM papers") as cur:
            row = await cur.fetchone()
        return int(row["n"]) if row else 0

    async def count_chunks(self) -> int:
        async with self._conn.execute("SELECT COUNT(*) AS n FROM chunks") as cur:
            row = await cur.fetchone()
        return int(row["n"]) if row else 0

    # ── helpers ───────────────────────────────────────────────────────────────────────

    async def _fetch_candidate_chunks(
        self, filters: RetrievalFilters | None
    ) -> list[aiosqlite.Row]:
        sql = """
            SELECT c.id, c.paper_id, c.ordinal, c.section, c.text, c.embedding,
                   p.arxiv_id, p.title, p.categories, p.published_at
            FROM chunks c JOIN papers p ON p.id = c.paper_id
        """
        async with self._conn.execute(sql) as cur:
            rows = await cur.fetchall()
        if filters is None or filters.is_empty:
            return list(rows)
        return [r for r in rows if _row_passes(r, filters)]

    @staticmethod
    def _row_to_scored(row: aiosqlite.Row, score: float, rank: int) -> ScoredChunk:
        return ScoredChunk(
            chunk_id=int(row["id"]),
            paper_id=int(row["paper_id"]),
            arxiv_id=row["arxiv_id"],
            paper_title=row["title"],
            ordinal=int(row["ordinal"]),
            section=row["section"],
            text=row["text"],
            score=score,
            rank=rank,
        )

    @staticmethod
    def _row_to_paper(row: aiosqlite.Row) -> Paper:
        return Paper(
            arxiv_id=row["arxiv_id"],
            title=row["title"],
            abstract=row["abstract"],
            authors=json.loads(row["authors"]),
            categories=json.loads(row["categories"]),
            published_at=_from_iso(row["published_at"]),
            updated_at=_from_iso(row["updated_at"]),
            pdf_url=row["pdf_url"],
            raw_meta=json.loads(row["raw_meta"]),
        )


def _to_paper_vector(paper_id: int, entry: dict) -> PaperVector:
    matrix = np.stack(entry["vectors"])
    mean = matrix.mean(axis=0)
    norm = float(np.linalg.norm(mean))
    if norm > 0:
        mean = mean / norm
    published = entry["published_at"]
    return PaperVector(
        paper_id=paper_id,
        arxiv_id=entry["arxiv_id"],
        title=entry["title"],
        categories=entry["categories"],
        authors=entry["authors"],
        year=published.year if published else None,
        vector=mean.astype(float).tolist(),
    )


def _row_passes(row: aiosqlite.Row, filters: RetrievalFilters | None) -> bool:
    if filters is None or filters.is_empty:
        return True
    if filters.categories:
        cats = set(json.loads(row["categories"]))
        if cats.isdisjoint(filters.categories):
            return False
    if filters.published_after:
        published = _from_iso(row["published_at"])
        if published is None or published < filters.published_after:
            return False
    return True


def _to_fts_match(query_text: str) -> str:
    """Turn free text into a safe FTS5 MATCH expression (OR of quoted terms)."""
    import re

    terms = re.findall(r"[A-Za-z0-9]+", query_text.lower())
    terms = [t for t in terms if len(t) > 1]
    if not terms:
        return ""
    return " OR ".join(f'"{t}"' for t in terms)
