"""Serverless entrypoint (Vercel's FastAPI runtime looks for ``app`` here).

The deployment filesystem is read-only outside the temp dir, so model caches go there,
and sensible defaults are applied before settings load: the bundled seed corpus as the
database, and Groq's gpt-oss models when a Groq key (``gsk_…``) is provided.
"""

import os
import tempfile

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

from veris.main import app  # noqa: E402

__all__ = ["app"]
