"""Application configuration, loaded from environment with a ``VERIS_`` prefix."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings.

    Values are read from environment variables prefixed with ``VERIS_`` (and a few
    well-known unprefixed names such as ``ANTHROPIC_API_KEY``). See ``.env.example``.
    """

    model_config = SettingsConfigDict(
        env_prefix="VERIS_",
        # Read .env whether the process starts in the repo root or in backend/.
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    env: Literal["development", "production"] = "development"
    log_level: str = "INFO"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    # Infrastructure
    database_url: str = "postgresql+asyncpg://veris:veris@localhost:5432/veris"

    # LLM — Claude, cost-tiered. ``anthropic_api_key`` is read without the VERIS_ prefix.
    # Sonnet for synthesis (near-Opus quality on grounded writing, 5x cheaper
    # output), Haiku for planning/verification.
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    synthesis_model: str = "claude-sonnet-5"
    utility_model: str = "claude-haiku-4-5-20251001"

    # Embeddings & reranking (local ONNX via fastembed)
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    reranker_model: str = "Xenova/ms-marco-MiniLM-L-6-v2"

    # Retrieval tuning
    dense_top_k: int = 40
    sparse_top_k: int = 40
    rerank_top_k: int = 12
    rrf_k: int = 60

    # Ingestion
    arxiv_api_url: str = "https://export.arxiv.org/api/query"
    ingest_batch_size: int = 50

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    """Return a cached ``Settings`` instance (one per process)."""
    return Settings()
