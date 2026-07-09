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

    # LLM — cost-tiered behind a provider port. ``llm_provider`` picks the adapter:
    #   auto      → Claude if ANTHROPIC_API_KEY is set, else HF router if HF_TOKEN is
    #               set, else the deterministic stub
    #   anthropic / hf / stub → force that adapter
    # ``anthropic_api_key`` / ``hf_token`` are read without the VERIS_ prefix.
    llm_provider: Literal["auto", "anthropic", "hf", "stub"] = "auto"
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    synthesis_model: str = "claude-sonnet-5"
    utility_model: str = "claude-haiku-4-5-20251001"

    # OpenAI-compatible route (Hugging Face Inference Providers by default). Any
    # /chat/completions endpoint works: Groq, Together, OpenRouter, local vLLM…
    hf_token: str = Field(default="", alias="HF_TOKEN")
    llm_base_url: str = "https://router.huggingface.co/v1"
    oss_synthesis_model: str = "meta-llama/Llama-3.3-70B-Instruct"
    oss_utility_model: str = "meta-llama/Llama-3.1-8B-Instruct"

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

    # Boot seeding. Comma-separated ingest topics run in the background at startup
    # when the corpus is empty — free-tier containers lose the SQLite file on every
    # restart, so this keeps a deployed demo self-healing. Empty = disabled.
    # Defaults target a ~100-paper corpus (4 topics x 25).
    seed_topics: str = ""
    seed_max_per_topic: int = 25

    @property
    def active_llm_provider(self) -> Literal["anthropic", "hf", "stub"]:
        """Resolve ``auto`` to the adapter the factory will actually build."""
        if self.llm_provider != "auto":
            return self.llm_provider
        if self.anthropic_api_key:
            return "anthropic"
        if self.hf_token:
            return "hf"
        return "stub"

    @property
    def effective_synthesis_model(self) -> str:
        """Synthesis model id for the active adapter (Claude vs open-weights)."""
        if self.active_llm_provider == "hf":
            return self.oss_synthesis_model
        return self.synthesis_model

    @property
    def effective_utility_model(self) -> str:
        """Utility model id for the active adapter (Claude vs open-weights)."""
        if self.active_llm_provider == "hf":
            return self.oss_utility_model
        return self.utility_model

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
