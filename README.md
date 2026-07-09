<div align="center">

# Veris

### Navigate the research landscape. Position your work. Trust every claim.

**Veris turns a corpus of arXiv papers into a living, explorable map of a field — and a
copilot that positions *your* research inside it.** Ask a question and get an answer where
every claim is traceable to a real paper and independently verified for entailment. Paste an
idea and see how novel it is, who works nearby, and where the open gaps are.

`FastAPI` · `LangGraph` · `pgvector` · `hybrid retrieval (RRF)` · `Claude (Sonnet + Haiku, cost-tiered)` ·
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
2. **A copilot that positions your own work.** Paste an abstract → a novelty read, the
   nearest prior work, adjacent researchers (from **public** author data — never contact
   info), open gaps, and a grounded, verified related-work draft.

Underneath both: a faithfulness engine — span-level citations + an **independent** verifier
that checks each claim is actually entailed by its evidence, plus cross-paper contradiction
detection and an open eval dashboard.

## The three pillars

| Pillar | What it does | Route |
|---|---|---|
| **Map of Science** | Explore the embedded corpus: clustered topics, a time-travel slider, semantic + co-authorship edges, ask-from-map highlighting. | `/map` |
| **Position my research** | Paste an idea → novelty radar, nearest work, adjacent labs/authors, gaps, grounded related-work. | `/position` |
| **Grounded Ask** | Ask a question → streamed answer, inline verifiable citations, claim verification, contradiction detection. | `/` |

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
 idea ─────► embed ─► nearest work + novelty + collaborators + gaps + grounded related-work  │
                                                                                             │
            project (UMAP/PCA) ─► cluster (KMeans) ─► label (Haiku) ─► Map of Science ───────┘
```

**Cost-tiered models:** high-volume calls (query planning, claim verification, cluster
labeling, gap-finding) run on **Claude Haiku 4.5**; final synthesis runs on **Claude Sonnet 5**
4.8**. Everything sits behind a provider interface with a deterministic stub, so the entire
product — including the map and position pipelines — runs and tests **with no API key**.

## Engineering decisions worth noting

| Decision | Rationale |
|---|---|
| **Two storage adapters, one `Store` port** | `SqliteStore` (FTS5 + NumPy) runs on a laptop with zero infra; `PostgresStore` (pgvector + FTS) is production. Downstream code never knows which is active. |
| **Hybrid + RRF, not just embeddings** | Dense retrieval misses lexical/rare-entity matches; Reciprocal Rank Fusion combines incomparable score scales robustly. |
| **Independent verifier** | The model that writes the answer is not trusted to grade it — a separate entailment pass flags unsupported claims. |
| **UMAP with a NumPy-PCA fallback** | The map always builds, even without the heavy `umap-learn`/`numba` stack on Windows. |
| **Local ONNX embeddings** (`fastembed`) | No GPU, no per-call embedding bill; a hashing embedder backs the tests offline. |
| **Model-aware Claude adapter** | Current Claude models reject `temperature`/`budget_tokens` and uses adaptive thinking + `effort`; Haiku supports neither. The adapter gates params per model so the first real Opus call doesn't 400. |
| **Public-data-only collaborators** | Author names + their public papers + a public-profile search link. No email/contact scraping — a deliberate ethics line. |
| **Per-call cost tracing + CI evals** | Every LLM call logs model/tokens/latency/USD; prompt/retrieval changes are gated on a measured faithfulness delta. |
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
| LLM | Claude **Sonnet 5** / **Haiku 4.5**, cost-tiered, behind a provider port (+ stub) |
| Embeddings | Local ONNX `fastembed` (bge-small) — no GPU |
| Frontend | Next.js 14 · Tailwind · Framer Motion · a custom **Canvas 2D** WebGL-grade map |
| Delivery | Docker + docker-compose · multi-stage · non-root · GitHub Actions CI |

## Repository layout

```
veris/
├── backend/veris/
│   ├── domain/        Pydantic models (Paper, Answer, MapArtifact, PositionReport, …)
│   ├── storage/       Store port + SQLite & Postgres adapters
│   ├── embeddings/    Embedder port + fastembed & hashing adapters
│   ├── llm/           Provider port, Claude adapter, stub, cost-tiered router, tracing
│   ├── ingestion/     arXiv client, chunker, ingestion service
│   ├── retrieval/     RRF fusion, reranker, hybrid retriever
│   ├── synthesis/     planner, synthesizer, AskService (streaming)
│   ├── grounding/     claim verifier + contradictions
│   ├── insights/      projection, clustering, map builder, position service, graph
│   ├── evals/         metrics, benchmark, harness
│   └── api/           FastAPI app, services container, v1 routers
├── frontend/          Next.js — Ask · Map · Position · Explore · Evals
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

## API

| Method | Route | Description |
|---|---|---|
| `POST` | `/v1/ask` | Grounded answer via **SSE** (`plan → citations → token… → verification → contradictions → done`) |
| `POST` | `/v1/ask/sync` | Non-streaming verified answer |
| `POST` | `/v1/position` | Position a research idea (novelty, nearest, collaborators, gaps, related-work) |
| `GET`  | `/v1/map` · `POST /v1/map/build` | Serve / rebuild the Map of Science |
| `GET`  | `/v1/papers` · `/v1/stats` · `/v1/evals` | Corpus, stats, eval report |

## Tests

```bash
cd backend && pytest -q          # 21 tests — data layer, RRF, LLM router, pipeline, map, position, API
cd frontend && npm run build     # typecheck + production build (8 routes)
```

The backend suite runs fully offline (stub LLM, in-memory SQLite, hashing embedder) and
exercises every pipeline end to end.

## License

MIT
