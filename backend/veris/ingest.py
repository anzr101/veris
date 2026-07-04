"""CLI entrypoint for corpus ingestion.

    python -m veris.ingest "multi-agent reinforcement learning" --max 50

Runs the same IngestionService the worker will run, against the configured store/embedder.
With no terms it pulls the latest cs.LG/cs.CL/cs.AI papers.
"""

from __future__ import annotations

import argparse
import asyncio

from veris.config import get_settings
from veris.core.logging import configure_logging, get_logger
from veris.embeddings.factory import build_embedder
from veris.ingestion.arxiv_client import ArxivClient
from veris.ingestion.service import DEFAULT_CATEGORIES, IngestionService
from veris.storage.factory import build_store

_log = get_logger("veris.ingest")


async def _run(terms: str | None, max_results: int, categories: tuple[str, ...]) -> None:
    settings = get_settings()
    configure_logging(settings.log_level)

    store = build_store(settings)
    await store.initialize()
    embedder = build_embedder(settings)
    client = ArxivClient(settings.arxiv_api_url)
    service = IngestionService(client, embedder, store)
    try:
        stats = await service.ingest(
            terms, categories=categories, max_results=max_results
        )
        _log.info("ingest.complete", papers=stats.papers, chunks=stats.chunks)
        print(f"Ingested {stats.papers} papers / {stats.chunks} chunks.")
    finally:
        await store.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest arXiv papers into Veris.")
    parser.add_argument("terms", nargs="?", default=None, help="Optional search terms.")
    parser.add_argument("--max", type=int, default=50, help="Max papers to fetch.")
    parser.add_argument(
        "--categories",
        nargs="*",
        default=list(DEFAULT_CATEGORIES),
        help="arXiv categories to draw from.",
    )
    args = parser.parse_args()
    asyncio.run(_run(args.terms, args.max, tuple(args.categories)))


if __name__ == "__main__":
    main()
