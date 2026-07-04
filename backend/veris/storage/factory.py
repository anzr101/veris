"""Select a storage adapter from settings.

SQLite for ``development`` (zero infra), Postgres for ``production``. The database URL's
scheme also forces a choice, so tests can pin SQLite explicitly.
"""

from __future__ import annotations

from veris.config import Settings
from veris.storage.base import Store


def build_store(settings: Settings) -> Store:
    url = settings.database_url
    use_sqlite = url.startswith("sqlite") or (not settings.is_production and "postgres" not in url)

    if use_sqlite or settings.env == "development":
        from veris.storage.sqlite_store import SqliteStore

        path = _sqlite_path(url)
        return SqliteStore(path)

    from veris.storage.postgres_store import PostgresStore

    return PostgresStore(url)


def _sqlite_path(url: str) -> str:
    # Accept sqlite URLs; otherwise default to a local file.
    if url.startswith("sqlite"):
        # sqlite+aiosqlite:///./veris.db  ->  ./veris.db   (':memory:' preserved)
        tail = url.split("///", 1)[-1] if "///" in url else url.split("://", 1)[-1]
        return tail or "veris.db"
    return "veris.db"
