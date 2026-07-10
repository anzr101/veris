"""FastAPI application entrypoint for the Veris API."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from veris import __version__
from veris.api.security import limiter, security_headers_middleware
from veris.config import get_settings
from veris.core.logging import configure_logging, get_logger
from veris.guardrails import GuardrailViolation
from veris.llm.errors import LLMUnavailableError


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup/shutdown lifecycle: build the shared Services container."""
    settings = get_settings()
    configure_logging(settings.log_level, json_logs=settings.is_production)
    log = get_logger("veris.startup")
    log.info("veris.starting", version=__version__, env=settings.env)

    from veris.api.state import Services

    app.state.services = await Services.create(settings)
    log.info("veris.ready", embedding_model=settings.embedding_model)

    seed_task: asyncio.Task[None] | None = None
    if settings.seed_topics:
        from veris.api.seeding import seed_if_empty

        seed_task = asyncio.create_task(seed_if_empty(app.state.services, settings))

    # Prebuild the map when the corpus is already populated (bundled starter corpus)
    # but the artifact file was lost with the ephemeral disk.
    from veris.api.v1.map import rebuild_map_background
    from veris.insights.map_builder import load_map

    map_task: asyncio.Task[None] | None = None
    if load_map() is None and await app.state.services.store.count_papers() > 0:
        map_task = asyncio.create_task(rebuild_map_background(app.state.services))

    try:
        yield
    finally:
        for task in (seed_task, map_task):
            if task is not None and not task.done():
                task.cancel()
        await app.state.services.close()
        log.info("veris.shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Veris API",
        version=__version__,
        summary="Citation-grounded research engine over arXiv.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security: per-IP rate limiting + hardening headers on every response.
    app.state.limiter = limiter
    app.middleware("http")(security_headers_middleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limited(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Rate limit exceeded: {exc.detail}. Try again shortly."},
        )

    @app.exception_handler(GuardrailViolation)
    async def guardrail_violation(request: Request, exc: GuardrailViolation) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.reason})

    @app.exception_handler(LLMUnavailableError)
    async def llm_unavailable(request: Request, exc: LLMUnavailableError) -> JSONResponse:
        # Auth/credit/rate-limit failures at the provider are an upstream outage,
        # not a server bug — tell the client what actually happened.
        return JSONResponse(
            status_code=503,
            content={"detail": f"LLM provider unavailable ({exc.provider}): {exc.detail}"},
        )

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    from veris.api.v1 import router as v1_router

    app.include_router(v1_router, prefix="/v1")

    return app


app = create_app()
