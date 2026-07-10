"""Application services container, built once at startup and shared across requests.

The store, embedder, and LLM provider are expensive singletons (DB pool, ONNX model, HTTP
client); the retriever and AskService are cheap wrappers over them. Held on ``app.state``
and exposed to handlers via the dependencies in ``deps.py``.
"""

from __future__ import annotations

from dataclasses import dataclass

from veris.config import Settings
from veris.embeddings.base import Embedder
from veris.embeddings.factory import build_embedder
from veris.ingestion.arxiv_client import ArxivClient
from veris.ingestion.service import IngestionService
from veris.llm.base import LLMProvider
from veris.llm.factory import build_provider
from veris.retrieval.retriever import HybridRetriever
from veris.storage.base import Store
from veris.storage.factory import build_store
from veris.synthesis.ask import AskService


@dataclass
class Services:
    settings: Settings
    store: Store
    embedder: Embedder
    provider: LLMProvider
    retriever: HybridRetriever
    ask: AskService
    ingestion: IngestionService

    @classmethod
    async def create(cls, settings: Settings) -> Services:
        store = build_store(settings)
        await store.initialize()
        embedder = build_embedder(settings)
        provider = build_provider(settings)
        retriever = HybridRetriever(store, embedder, settings)
        ask = AskService(provider, retriever, settings)
        ingestion = IngestionService(ArxivClient(settings.arxiv_api_url), embedder, store)
        return cls(
            settings=settings,
            store=store,
            embedder=embedder,
            provider=provider,
            retriever=retriever,
            ask=ask,
            ingestion=ingestion,
        )

    async def close(self) -> None:
        await self.store.close()
