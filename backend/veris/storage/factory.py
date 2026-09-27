"""Select a storage adapter from settings.

SQLite for ``development`` (zero infra), Postgres for ``production``. The database URL's
scheme also forces a choice, so tests can pin SQLite explicitly.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

from veris.config import Settings
from veris.storage.base import Store

# backend/ — where the bundled seed corpus lives, whatever the process cwd is.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]


def build_store(settings: Settings) -> Store:
    url = settings.database_url
    use_sqlite = url.startswith("sqlite") or (not settings.is_production and "postgres" not in url)

    if use_sqlite or settings.env == "development":
        from veris.storage.sqlite_store import SqliteStore

        return SqliteStore(_writable(_sqlite_path(url)))

    from veris.storage.postgres_store import PostgresStore

    return PostgresStore(url)


def _sqlite_path(url: str) -> str:
    # Accept sqlite URLs; otherwise default to a local file.
    if url.startswith("sqlite"):
        # sqlite+aiosqlite:///./veris.db  ->  ./veris.db   (':memory:' preserved)
        tail = url.split("///", 1)[-1] if "///" in url else url.split("://", 1)[-1]
        return tail or "veris.db"
    return "veris.db"


def _writable(path: str) -> str:
    """Resolve the database file and make sure SQLite can open it for writing.

    Serverless runtimes mount the deployment read-only; there the bundled corpus is
    copied to the temp dir once per instance and opened from there.
    """
    if path == ":memory:":
        return path
    p = Path(path)
    if not p.is_absolute() and not p.exists() and (_BACKEND_ROOT / p).exists():
        p = _BACKEND_ROOT / p
    if os.access(p.parent, os.W_OK):
        return str(p)
    target = Path(tempfile.gettempdir()) / p.name
    if p.exists() and not target.exists():
        shutil.copyfile(p, target)
    return str(target)
