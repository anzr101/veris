"""CLI to precompute the Map of Science.

    python -m veris.buildmap

Loads the corpus, builds the map artifact, and writes it to insights/results/map.json
(served by GET /v1/map). Also runnable as a scheduled worker job.
"""

from __future__ import annotations

import asyncio

from veris.api.state import Services
from veris.config import get_settings
from veris.core.logging import configure_logging, get_logger
from veris.insights.map_builder import build_map, save_map
from veris.llm.router import LLMRouter

_log = get_logger("veris.buildmap")


def router_from(services: Services) -> LLMRouter:
    s = services.settings
    return LLMRouter(
        services.provider, synthesis_model=s.synthesis_model, utility_model=s.utility_model
    )


async def run() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    services = await Services.create(settings)
    try:
        artifact = await build_map(
            services.store, router_from(services), embedding_model=settings.embedding_model
        )
        save_map(artifact)
        _log.info(
            "buildmap.done",
            papers=artifact.n_papers,
            clusters=len(artifact.clusters),
            edges=len(artifact.edges),
        )
        print(
            f"Map built: {artifact.n_papers} papers, "
            f"{len(artifact.clusters)} clusters, {len(artifact.edges)} edges."
        )
    finally:
        await services.close()


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
