# Veris — Architecture

This document describes the system design, the data model, and — most importantly — the
**grounding pipeline** that is the product's reason to exist.

## Design principles

1. **Faithfulness over fluency.** The system is allowed to say "the literature does not
   answer this." It is never allowed to fabricate support.
2. **Hexagonal / ports-and-adapters.** Domain logic depends on interfaces (`Retriever`,
   `LLMProvider`, `Embedder`, `Reranker`), never on concrete vendors. Swapping Claude for
   another model, or pgvector for another store, touches one adapter.
3. **Cost is a first-class design input.** Every LLM call is routed by a tier policy and
   traced (tokens, latency, cost). Cheap models do the high-volume work.
4. **Everything is measured.** No retrieval or prompt change ships without an eval delta.

## Component view

```
              ┌──────────────────────────── API (FastAPI, async) ────────────────────────────┐
              │  POST /v1/ask  (SSE stream)   GET /v1/papers   GET /v1/evals   /health        │
              └───────────────────────────────────┬──────────────────────────────────────────┘
                                                   │
          ┌────────────────────────────── Application services ──────────────────────────────┐
          │  AskService  ·  IngestionService  ·  EvalService                                  │
          └───┬───────────────┬────────────────┬──────────────────┬───────────────┬──────────┘
              │               │                │                  │               │
        QueryPlanner     Retriever         Synthesizer        Grounder        Tracer
       (Haiku 4.5)   (hybrid + RRF +      (Sonnet 5)      (decompose →     (per-call
                      rerank, ports)                       verify → cite)   tokens/cost)
              │               │                                  │
        ┌─────┴───────────────┴──────────────────────────────────┴─────┐
        │  Adapters: AnthropicProvider · PgVectorStore · FastEmbed ·     │
        │            FtsSparseIndex · ArxivClient           │
        └───────────────────────────────────────────────────────────────┘
                                   │                        │
                            Postgres + pgvector
```

## Data model (Phase 1)

- **papers** — `id`, `arxiv_id`, `title`, `abstract`, `authors`, `categories`,
  `published_at`, `updated_at`, `pdf_url`, `raw_meta (jsonb)`.
- **chunks** — `id`, `paper_id (fk)`, `ordinal`, `section`, `text`, `token_count`,
  `tsv (tsvector, generated)`. One row per retrievable passage.
- **chunk_embeddings** — `chunk_id (fk)`, `model`, `embedding (vector)`. Separated from
  `chunks` so we can re-embed with a new model without rewriting text.
- **queries** — `id`, `question`, `plan (jsonb)`, `created_at`.
- **answers** — `id`, `query_id (fk)`, `markdown`, `claims (jsonb)`, `citations (jsonb)`,
  `verification (jsonb)`, `cost_usd`, `latency_ms`, `model`.

Indexes: HNSW on `chunk_embeddings.embedding` (cosine), GIN on `chunks.tsv`,
btree on `papers.arxiv_id` (unique) and `papers.published_at`.

## The grounding pipeline (the moat)

The pipeline is orchestrated as a **LangGraph state machine** (`veris/pipeline/graph.py`):
`plan → retrieve → synthesize → verify`, with a conditional edge that skips verification
when nothing was retrieved. Nodes wrap the existing services and publish UI events through
LangGraph's custom stream writer, so the same compiled graph powers both the SSE streaming
endpoint and the synchronous path used by the eval harness. Each node is LangSmith-traceable
(env-gated — set `LANGSMITH_TRACING` + `LANGSMITH_API_KEY`).

Around the graph sit two deterministic **guardrails** (`veris/guardrails/`): an input guard
that sanitizes user text and rejects prompt-injection patterns before any LLM call (HTTP 422
with an explainable reason), and an output guard that strips citation markers not backed by
a retrieved passage and computes the grounded-claim share used as the faithfulness score.

Given a question, the request flows:

1. **Query planning** *(Haiku 4.5)* — decompose the question into sub-queries and extract
   filters (date ranges, categories). Cheap model, structured output.
2. **Hybrid retrieval** — for each sub-query:
   - **Dense**: cosine kNN over `chunk_embeddings` via pgvector (HNSW).
   - **Sparse**: Postgres full-text search over `chunks.tsv` (BM25-style ranking).
   - **Fusion**: results merged with **Reciprocal Rank Fusion (RRF)**.
   - **Rerank**: top-k passed through a cross-encoder reranker for final ordering.
3. **Synthesis** *(Sonnet 5)* — answer is generated **only** from the retrieved passages,
   each passage carrying a stable citation id. The prompt forbids using outside knowledge.
4. **Grounding & verification** *(Phase 2, Haiku 4.5 + NLI)*:
   - Decompose the answer into **atomic claims**.
   - For each claim, locate the supporting **evidence span(s)** among retrieved passages.
   - Run an **entailment check**: does the evidence actually entail the claim? Unsupported
     claims are flagged and either dropped or surfaced with a low-confidence marker.
5. **Contradiction / consensus** *(Phase 2)* — cluster claims across papers; mark where
   sources agree vs. disagree.

Output: markdown answer + a structured `citations` map + a `verification` report
(per-claim support status and confidence).

## Observability

Every LLM call is wrapped by a `Tracer` that records model, prompt/response token counts,
latency, and computed USD cost, tagged by request id and pipeline stage. This feeds both
the cost report and debugging of faithfulness regressions. With LangSmith enabled, every
graph node (plan/retrieve/synthesize/verify) additionally lands as a traced run with
timings, giving per-stage visibility across requests.

## API security

- **Rate limiting** (slowapi, per-IP token buckets keyed on the first `X-Forwarded-For`
  hop): tight limits on the LLM-backed endpoints (`/ask` 10/min, `/position` 6/min,
  `/ingest` 3/min), a generous default elsewhere.
- **Security headers** on every response (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Cache-Control`).
- **Input validation**: strict Pydantic length caps plus the guardrail screen described
  above; control characters are stripped before text reaches a prompt.

## Why these choices signal production thinking

- **Hybrid + RRF** instead of "just embeddings" — dense retrieval alone misses exact-term
  and rare-entity matches; the fusion is where real retrieval quality lives.
- **Separate embeddings table** — re-embedding is an operational reality, not a rewrite.
- **Local ONNX embeddings** — no GPU, no per-call embedding bill, deployable anywhere.
- **Independent verifier** — the model that writes the answer is not trusted to grade it.
- **Evals in CI** — prompt/retrieval changes are gated on a measured faithfulness delta.
