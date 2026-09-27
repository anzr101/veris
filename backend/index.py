"""Serverless entrypoint (Vercel's FastAPI runtime looks for ``app`` here).

The deployment filesystem is read-only outside the temp dir, so model caches go there,
and sensible defaults are applied before settings load: the bundled seed corpus as the
database, and Groq's gpt-oss models when a Groq key (``gsk_…``) is provided.

If the app fails to import or start, a minimal app reports the failure on every route
instead of the platform returning an opaque 500 — the only window into a serverless
cold start that has no reachable logs.
"""

import os
import tempfile
import traceback
from contextlib import asynccontextmanager

_tmp = tempfile.gettempdir()
os.environ.setdefault("HF_HOME", os.path.join(_tmp, "hf"))
os.environ.setdefault("FASTEMBED_CACHE_PATH", os.path.join(_tmp, "fastembed"))
os.environ.setdefault("VERIS_ENV", "production")
os.environ.setdefault("VERIS_DATABASE_URL", "sqlite+aiosqlite:///seed_corpus.db")

_key = os.environ.get("GROQ_API_KEY") or os.environ.get("HF_TOKEN", "")
if _key.startswith("gsk_"):
    os.environ.setdefault("HF_TOKEN", _key)
    os.environ.setdefault("VERIS_LLM_PROVIDER", "hf")
    os.environ.setdefault("VERIS_LLM_BASE_URL", "https://api.groq.com/openai/v1")
    os.environ.setdefault("VERIS_OSS_SYNTHESIS_MODEL", "openai/gpt-oss-120b")
    os.environ.setdefault("VERIS_OSS_UTILITY_MODEL", "openai/gpt-oss-20b")

_startup_error: str | None = None

try:
    from veris.main import app
except Exception:  # pragma: no cover - deployment diagnostics
    _startup_error = "import failed:\n" + traceback.format_exc()
    from fastapi import FastAPI

    app = FastAPI()
else:
    _lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def _guarded(a):  # type: ignore[no-untyped-def]
        global _startup_error
        cm = _lifespan(a)
        try:
            await cm.__aenter__()
        except Exception:
            _startup_error = "startup failed:\n" + traceback.format_exc()
            yield
            return
        try:
            yield
        finally:
            await cm.__aexit__(None, None, None)

    app.router.lifespan_context = _guarded


@app.middleware("http")
async def _report_startup_error(request, call_next):  # type: ignore[no-untyped-def]
    if _startup_error is not None:
        from fastapi.responses import PlainTextResponse

        return PlainTextResponse(_startup_error, status_code=503)
    return await call_next(request)


__all__ = ["app"]
