<div align="center">

# Veris

### Navigate the research landscape. Trust every claim.

**Veris turns a corpus of arXiv papers into a living, explorable map of a field.** Ask a
question and get an answer where every claim is traceable to a real paper and independently
verified for entailment.

`FastAPI` · `LangGraph` · `pgvector` · `hybrid retrieval (RRF)` · `gpt-oss-120b / 20b on Groq (cost-tiered, provider-agnostic)` ·
`guardrails` · `LangSmith` · `scikit-learn` · `Next.js` · `Canvas/Framer Motion` · `Docker` · `GitHub Actions`

</div>

---

## Why it's different

"Ask the literature" tools are crowded and they all generate fluent summaries you can't
trust. Veris is built around two ideas almost no one ships:

1. **A map you can fly through.** The same embeddings that power retrieval are projected,
   clustered, and rendered as an interactive map — topics as constellations, time as motion,
   density as crowded-vs-open frontier. It's the difference between *reading* a field and
   *seeing* it.
2. **A faithfulness engine.** Span-level citations plus an **independent** verifier that
   checks each claim is actually entailed by its evidence, with cross-paper contradiction
   detection.

## The two pillars

| Pillar | What it does | Route |
|---|---|---|
| **Grounded Ask** | Ask a question → streamed answer, inline verifiable citations, claim verification, contradiction detection. | `/` |
| **Map of Science** | Explore the embedded corpus: clustered topics, a time-travel slider, semantic + co-authorship edges, ask-from-map highlighting. | `/map` |

## How it works

```
                ┌──────────────────────────────────────────────────────────────┐
   arXiv  ──►   │  Ingestion:  fetch → parse → chunk → embed → index            │
                └──────────────────────────────────────────────────────────────┘
                                          │
                Postgres + pgvector (dense)  +  FTS / BM25 (sparse)   ── shared embeddings ──┐
                                          │                                                  │
 question ─► [LangGraph] plan(Haiku) ─► hybrid retrieve (dense+sparse+RRF) ─► synthesize(Sonnet) ─► verify │
                                          │                          + cite + contradictions │
            project (UMAP/PCA) ─► cluster (KMeans) ─► label (Haiku) ─► Map of Science ───────┘
```

**Cost-tiered models:** high-volume calls (query planning, claim verification, cluster
labeling) run on the cheap utility tier; final synthesis runs on the strong tier. Everything
sits behind a provider interface with a deterministic stub, so the entire product — including
the map pipeline — runs and tests **with no API key**.

## Engineering decisions worth noting

| Decision | Rationale |
|---|---|
| **Two storage adapters, one `Store` port** | `SqliteStore` (FTS5 + NumPy) runs on a laptop with zero infra; `PostgresStore` (pgvector + FTS) is production. Downstream code never knows which is active. |
| **Hybrid + RRF, not just embeddings** | Dense retrieval misses lexical/rare-entity matches; Reciprocal Rank Fusion combines incomparable score scales robustly. |
| **Independent verifier** | The model that writes the answer is not trusted to grade it — a separate entailment pass flags unsupported claims. |
| **UMAP with a NumPy-PCA fallback** | The map always builds, even without the heavy `umap-learn`/`numba` stack on Windows. |
| **Local ONNX embeddings** (`fastembed`) | No GPU, no per-call embedding bill; a hashing embedder backs the tests offline. |
| **Model-aware Claude adapter** | Current Claude models reject `temperature`/`budget_tokens` and uses adaptive thinking + `effort`; Haiku supports neither. The adapter gates params per model so the first real Opus call doesn't 400. |
| **Per-call cost tracing** | Every LLM call logs model/tokens/latency/USD, tagged by pipeline stage. |
| **LangGraph orchestration** | The ask pipeline is a `StateGraph` (plan → retrieve → synthesize → verify) with a conditional verify edge; nodes emit UI events via the custom stream writer, so one graph serves both SSE streaming and the sync path. |
| **Deterministic guardrails around the LLM** | An input guard sanitizes text and blocks prompt-injection patterns before any model call; an output guard strips citation markers that don't map to retrieved evidence. Cheap, auditable, and testable — the LLM verifier sits on top. |
| **Rate-limited, hardened API** | Per-IP limits on the LLM-backed endpoints (slowapi), security headers on every response, strict request length caps. |

## Tech stack

| Layer | Choice |
|---|---|
| Backend | FastAPI (async), hexagonal architecture, Pydantic v2 |
| Orchestration | **LangGraph** state machine for the ask pipeline; **LangSmith** tracing (env-gated) |
| Safety | Input/output **guardrails** (prompt-injection screen, citation-bounds check) · independent claim verifier |
| Security | **slowapi** per-IP rate limiting · security headers · strict input validation |
| Data | Postgres + **pgvector** (prod) · SQLite + **FTS5** (dev) |
| Retrieval | Dense + sparse fused with **RRF** + pluggable rerank |
| Insights | scikit-learn (KMeans/PCA), optional UMAP; semantic + co-authorship graph |
| LLM | **gpt-oss-120b** (synthesis) / **gpt-oss-20b** (planning, verification) on Groq via an OpenAI-compatible adapter; Claude adapter and a stub behind the same port |
| Embeddings | Local ONNX `fastembed` (bge-small) — no GPU |
| Frontend | Next.js 14 · Tailwind · Framer Motion · a custom **Canvas 2D** WebGL-grade map |
| Delivery | Docker + docker-compose · multi-stage · non-root · GitHub Actions CI |

## Repository layout

```
veris/
├── backend/veris/
│   ├── domain/        Pydantic models (Paper, Answer, MapArtifact, …)
│   ├── storage/       Store port + SQLite & Postgres adapters
│   ├── embeddings/    Embedder port + fastembed & hashing adapters
│   ├── llm/           Provider port, adapters, stub, cost-tiered router, tracing
│   ├── ingestion/     arXiv client, chunker, ingestion service
│   ├── retrieval/     RRF fusion, reranker, hybrid retriever
│   ├── pipeline/      the LangGraph ask state machine
│   ├── synthesis/     planner, synthesizer, AskService (streaming)
│   ├── grounding/     claim verifier + contradictions
│   ├── guardrails/    input screen + citation-bounds output check
│   ├── insights/      projection, clustering, map builder, co-author graph
│   └── api/           FastAPI app, services container, security, v1 routers
├── frontend/          Next.js — Ask · Map · Explore
├── docker-compose.yml db · api · web
└── ARCHITECTURE.md    system design + the grounding pipeline
```

## Quickstart (laptop, zero infrastructure)

Runs on Python + Node alone (SQLite + FTS5). A real `ANTHROPIC_API_KEY` enables live Claude;
without it the stub keeps everything runnable.

```bash
# 1. Backend
cd backend
python -m venv .venv && .venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
python -m veris.ingest "your research area" --max 300  # seed a corpus (more papers = better map)
python -m veris.buildmap                               # precompute the Map of Science
uvicorn veris.main:app --reload                        # http://localhost:8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                                            # http://localhost:3000
```

Put your key in `backend/.env` **or** the repo-root `.env` (both are read). After ingesting
more papers, re-run `python -m veris.buildmap` to refresh the map. For a semantically rich
map, ingest a few hundred papers with the default `bge` embedder.

> Full production stack (Postgres + API + web) is one `make up` away once Docker
> is available — the Dockerfiles and compose file are included.

## Deploy (Vercel, two projects)

| Project | Root directory | Environment |
|---|---|---|
| API | `backend` | `VERIS_ENV=production`, `VERIS_DATABASE_URL=sqlite+aiosqlite:///seed_corpus.db`, `VERIS_LLM_PROVIDER=hf`, `VERIS_LLM_BASE_URL=https://api.groq.com/openai/v1`, `VERIS_OSS_SYNTHESIS_MODEL=openai/gpt-oss-120b`, `VERIS_OSS_UTILITY_MODEL=openai/gpt-oss-20b`, `HF_TOKEN=<Groq API key>` |
| Web | `frontend` | `BACKEND_INTERNAL_URL=<API deployment URL>` |

The API boots from the bundled pre-embedded corpus and precomputed topic map, so the
serverless function needs no database or build step. `backend/Dockerfile` runs the same
service on any container host.

## API

| Method | Route | Description |
|---|---|---|
| `POST` | `/v1/ask` | Grounded answer via **SSE** (`plan → citations → token… → verification → contradictions → done`) |
| `POST` | `/v1/ask/sync` | Non-streaming verified answer |
| `GET`  | `/v1/map` · `POST /v1/map/build` | Serve / rebuild the Map of Science |
| `GET`  | `/v1/papers` · `/v1/stats` | Corpus and stats |

## Tests

```bash
cd backend && pytest -q          # data layer, RRF, LLM router, guardrails, pipeline, map, API
cd frontend && npm run build     # typecheck + production build
```

The backend suite runs fully offline (stub LLM, in-memory SQLite, hashing embedder) and
exercises every pipeline end to end.

## License

MIT
