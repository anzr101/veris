# Veris — Delivery Roadmap

## Phase 1 — The spine  ✅

End-to-end grounded answering, runnable on a laptop with zero infrastructure.

- [x] Repository foundation, Docker stack, backend app skeleton, CI
- [x] Domain models + storage port + **SQLite adapter** (dense via NumPy, sparse via FTS5/BM25) — tested
- [x] **Postgres adapter** (pgvector + FTS) behind the same storage port
- [x] Embedder port (dependency-free hashing fallback + local ONNX fastembed)
- [x] LLM provider port + Claude adapter (model-aware) + cost-tiered router + per-call tracing
- [x] arXiv ingestion: fetch → robust parse → chunk → embed → index (CLI + arq worker)
- [x] Hybrid retrieval: dense + sparse fused with **RRF** + pluggable rerank
- [x] Grounded synthesis: query plan → retrieve → synthesize with inline citations (streaming)
- [x] FastAPI endpoints (SSE + sync) + Next.js app
- [x] Dockerized, CI green, full test suite

## Phase 2 — The moat  ✅

- [x] Claim decomposition + entailment verification (independent of the synthesizer)
- [x] Contradiction / consensus detection across retrieved papers
- [x] Eval harness (faithfulness / citation-coverage / grounded-claim rate)
- [x] Public faithfulness dashboard (**/evals**)

## Phase 3 — The wow

- [ ] Trend / knowledge-graph view over the embedded corpus (clustering + temporal trends)
- [ ] Cross-encoder reranker wired into the retrieval factory (port already in place)
- [ ] Langfuse/OpenTelemetry export for the existing per-call traces
- [ ] Demo video + technical write-up
