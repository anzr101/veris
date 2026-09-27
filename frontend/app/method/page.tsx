"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getStats } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { Corners, PageHead, SectionHead } from "@/components/ui";
import { PipelineDiagram } from "@/components/overview/pipeline-diagram";

const reveal = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

export default function MethodPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);
  const embed = (stats?.embedding_model ?? "BAAI/bge-small-en-v1.5").split("/").pop();

  return (
    <div className="flex-1">
      <div className="grid-paper border-b border-line">
        <div className="mx-auto max-w-page px-5 pb-16 pt-14 sm:px-8">
          <PageHead index="06" title="Method" meta="Retrieval-augmented generation with independent verification" />
          <div className="mt-14">
            <PipelineDiagram stats={stats} />
          </div>
        </div>
      </div>

      {/* ── Ingestion ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-page px-5 py-20 sm:px-8">
        <SectionHead index="6.1" title="Ingestion" />
        <motion.div {...reveal} className="mt-12 grid gap-px border border-line bg-line md:grid-cols-4">
          {[
            { k: "Source", v: "arXiv API", d: "cs.LG · cs.CL · cs.AI" },
            { k: "Chunking", v: "~90 words", d: "Sentence windows, 1-sentence overlap; title kept as its own passage" },
            { k: "Embedding", v: embed ?? "bge-small", d: "384-d, L2-normalised, local ONNX" },
            { k: "Index", v: "Vectors + FTS5", d: "Cosine over float32 matrix · BM25 full-text" },
          ].map((s) => (
            <div key={s.k} className="bg-surface p-6">
              <div className="label">{s.k}</div>
              <div className="mt-3 text-[20px] font-light tracking-[-0.01em]">{s.v}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.d}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── Retrieval ─────────────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
          <SectionHead index="6.2" title="Hybrid retrieval" />
          <div className="mt-12 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <motion.div {...reveal}>
              <RetrievalFigure />
            </motion.div>
            <motion.div {...reveal} className="panel p-7">
              <Corners />
              <div className="label">Reciprocal rank fusion</div>
              <div className="mt-5 text-[22px] font-light tracking-[-0.01em] text-ink">
                score(d) = <span className="text-blue">Σ</span>
                <sub className="text-[13px] text-muted">r ∈ R</sub>{" "}
                <span className="inline-flex flex-col items-center align-middle text-[18px] leading-tight">
                  <span className="border-b border-ink px-2">1</span>
                  <span className="px-2">k + rank<sub className="text-[11px]">r</sub>(d)</span>
                </span>
              </div>
              <dl className="mt-7 space-y-2 border-t border-line pt-5 text-[13.5px]">
                {[
                  ["k", "60"],
                  ["Dense candidates", "40"],
                  ["Sparse candidates", "40"],
                  ["Passages to synthesis", "12"],
                ].map(([a, b]) => (
                  <div key={a} className="flex justify-between">
                    <dt className="text-muted">{a}</dt>
                    <dd className="text-ink">{b}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Grounding ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-page px-5 py-20 sm:px-8">
        <SectionHead index="6.3" title="Grounding and verification" />
        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "A", t: "Input guard", d: "Sanitises the question and blocks prompt-injection patterns before any model call." },
            { n: "B", t: "Evidence-only synthesis", d: "The writer sees numbered passages and must cite them; outside knowledge is disallowed." },
            { n: "C", t: "Output guard", d: "Citation markers that point at no retrieved passage are stripped." },
            { n: "D", t: "Independent verifier", d: "A separate model splits the answer into atomic claims and judges each against its cited evidence." },
          ].map((s, i) => (
            <motion.li key={s.n} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }} className="panel p-6">
              <Corners />
              <div className="flex h-8 w-8 items-center justify-center border border-blue/30 text-[13px] font-medium text-blue">
                {s.n}
              </div>
              <div className="mt-5 text-[17px] font-medium">{s.t}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{s.d}</p>
            </motion.li>
          ))}
        </ol>

        <motion.div
          {...reveal}
          className="grid-navy relative mt-10 grid gap-8 bg-navy px-8 py-10 text-white md:grid-cols-[1fr_auto] md:items-center"
        >
          <Corners dark />
          <div>
            <div className="label-dark">Faithfulness</div>
            <div className="mt-4 text-[26px] font-light tracking-[-0.01em] sm:text-[32px]">
              supported claims <span className="text-blue-ice/50">/</span> total claims
            </div>
          </div>
          <div className="flex gap-3 text-[12.5px]">
            {[
              ["Supported", "bg-ok"],
              ["Partial", "bg-warn"],
              ["Unsupported", "bg-bad"],
            ].map(([l, c]) => (
              <span key={l} className="flex items-center gap-2 border border-navy-line px-3 py-2 text-blue-ice/80">
                <span className={`h-2 w-2 rounded-full ${c}`} /> {l}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Stack ─────────────────────────────────────────────────────────────── */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
          <SectionHead index="6.4" title="Stack" />
          <motion.table {...reveal} className="mt-12 w-full border-t border-ink text-left text-[14px]">
            <tbody>
              {[
                ["API", "FastAPI · async · Server-Sent Events", "Hexagonal: ports for store, embedder, LLM, reranker"],
                ["Orchestration", "LangGraph state machine", "plan → retrieve → synthesize → verify"],
                ["Language models", `${stats?.synthesis_model ?? "gpt-oss-120b"} · ${stats?.utility_model ?? "gpt-oss-20b"}`, "Cost-tiered behind an OpenAI-compatible adapter"],
                ["Embeddings", stats?.embedding_model ?? "BAAI/bge-small-en-v1.5", "fastembed · ONNX Runtime"],
                ["Storage", "SQLite FTS5 + vector matrix", "Postgres + pgvector adapter for scale-out"],
                ["Safety", "Rate limiting · security headers · guardrails", "slowapi token buckets per client"],
                ["Interface", "Next.js · Framer Motion · Canvas 2D", "Streaming UI, zero client-side secrets"],
              ].map(([a, b, c]) => (
                <tr key={a} className="border-b border-line align-top">
                  <th className="w-[180px] py-4 pr-6 font-normal text-muted">{a}</th>
                  <td className="py-4 pr-6 text-ink">{b}</td>
                  <td className="hidden py-4 text-muted md:table-cell">{c}</td>
                </tr>
              ))}
            </tbody>
          </motion.table>
        </div>
      </section>
    </div>
  );
}

/** Query fans out to dense and sparse retrievers, which fuse into one ranked list. */
function RetrievalFigure() {
  const box = "absolute flex flex-col justify-center border bg-surface px-4";
  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-[640px] text-[13px]">
      <svg viewBox="0 0 640 400" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="#1F4FD8" />
          </marker>
        </defs>
        <g fill="none" stroke="#1F4FD8" strokeWidth="1.2" markerEnd="url(#arr)">
          <path d="M150 200 C 200 200, 200 90, 238 90" />
          <path d="M150 200 C 200 200, 200 310, 238 310" />
          <path d="M402 90 C 440 90, 440 200, 478 200" />
          <path d="M402 310 C 440 310, 440 200, 478 200" />
        </g>
        <g fill="none" stroke="rgba(31,79,216,0.25)" strokeWidth="1" strokeDasharray="3 4">
          <path d="M150 200 L 478 200" />
        </g>
      </svg>
      <div className={`${box} left-0 top-[42%] h-[16%] w-[23%] border-navy bg-navy text-white`}>
        <span className="text-[11px] uppercase tracking-label text-blue-ice/60">Input</span>
        <span className="mt-0.5">Sub-queries</span>
      </div>
      <div className={`${box} left-[37.5%] top-[14%] h-[17%] w-[25.5%] border-line`}>
        <span className="label">Dense</span>
        <span className="mt-0.5 text-ink">Cosine kNN · 40</span>
      </div>
      <div className={`${box} left-[37.5%] top-[69%] h-[17%] w-[25.5%] border-line`}>
        <span className="label">Sparse</span>
        <span className="mt-0.5 text-ink">BM25 · 40</span>
      </div>
      <div className={`${box} left-[75%] top-[40%] h-[20%] w-[25%] border-blue bg-blue text-white`}>
        <span className="text-[11px] uppercase tracking-label text-white/70">RRF</span>
        <span className="mt-0.5">Top 12 passages</span>
      </div>
    </div>
  );
}
