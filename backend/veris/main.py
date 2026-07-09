"""FastAPI application entrypoint for the Veris API."""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from veris import __version__
from veris.config import get_settings
from veris.core.logging import configure_logging, get_logger
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
    try:
        yield
    finally:
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
