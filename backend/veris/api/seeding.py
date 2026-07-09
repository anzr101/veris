"""Self-seeding for ephemeral deployments.

Free-tier containers get a fresh filesystem on every restart, which wipes the SQLite
corpus. When ``VERIS_SEED_TOPICS`` is set and the corpus is empty at startup, this
re-ingests a small default corpus in the background and prebuilds the map, so a cold
start heals itself instead of serving an empty product. Every step is best-effort:
a failed topic is logged and skipped, never fatal.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from veris.config import Settings
from veris.core.logging import get_logger

if TYPE_CHECKING:
    from veris.api.state import Services

_log = get_logger("veris.seeding")


async def seed_if_empty(services: Services, settings: Settings) -> None:
    if await services.store.count_papers() > 0:
        return
    topics = [t.strip() for t in settings.seed_topics.split(",") if t.strip()]
    if not topics:
        return

    _log.info("seed.start", topics=topics, max_per_topic=settings.seed_max_per_topic)
    for topic in topics:
        try:
            stats = await services.ingestion.ingest(
                topic, max_results=settings.seed_max_per_topic
            )
            _log.info("seed.topic_done", topic=topic, papers=stats.papers)
        except Exception:
            _log.exception("seed.topic_failed", topic=topic)
        # Rebuild the map after every topic, not just at the end: seeding a large
        # corpus takes a while on a small container, and a progressively filling map
        # beats an empty page (it also survives a restart mid-seed).
        await _rebuild_map(services, settings)


async def _rebuild_map(services: Services, settings: Settings) -> None:
    try:
        from veris.buildmap import router_from
        from veris.insights.map_builder import build_map, save_map

        artifact = await build_map(
            services.store, router_from(services), embedding_model=settings.embedding_model
        )
        if artifact.n_papers > 0:
            save_map(artifact)
        _log.info("seed.map_built", n_papers=artifact.n_papers)
    except Exception:
        _log.exception("seed.map_failed")
