"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getAllPapers, getMap, getStats } from "@/lib/api";
import type { MapArtifact, Paper, Stats } from "@/lib/types";
import { byNewest, formatDate, topicsFrom } from "@/lib/corpus";
import { topicColor } from "@/lib/palette";
import { ease } from "@/lib/motion";
import { AskInput } from "@/components/ask/ask-input";
import { Corners, Readout, SectionHead } from "@/components/ui";
import { HeroField } from "@/components/overview/hero-field";
import { PipelineDiagram } from "@/components/overview/pipeline-diagram";
import { TopicThumb } from "@/components/overview/topic-thumb";

const EXAMPLES = [
  "How are generative world models used in autonomous driving?",
  "How do agents stay policy-compliant when calling tools?",
  "Where do neural operators beat classical PDE solvers?",
];

export default function Overview() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [map, setMap] = useState<MapArtifact | null>(null);
  const [papers, setPapers] = useState<Paper[] | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    getMap().then(setMap).catch(() => {});
    getAllPapers().then(setPapers).catch(() => {});
  }, []);

  const ask = (q: string) => router.push(`/ask?q=${encodeURIComponent(q)}`);
  const topics = useMemo(() => (map ? topicsFrom(map) : []), [map]);
  const bounds = useMemo(() => {
    if (!map) return { x0: 0, x1: 1, y0: 0, y1: 1 };
    const xs = map.nodes.map((n) => n.x);
    const ys = map.nodes.map((n) => n.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }, [map]);
  const latest = useMemo(() => (papers ? byNewest(papers).slice(0, 6) : []), [papers]);

  return (
    <>
      {/* ── Hero: the instrument ───────────────────────────────────────────────── */}
      <section className="grid-navy relative overflow-hidden bg-navy-deep text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_75%_40%,rgba(31,79,216,0.28),transparent_70%)]" />
        <div className="relative mx-auto grid max-w-page gap-12 px-5 pb-20 pt-16 sm:px-8 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:py-16">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
              className="label-dark flex items-center gap-3"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-blue-bright" />
              Research instrument
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.8, ease }}
              className="mt-6 font-light leading-[1] tracking-[-0.035em]"
              style={{ fontSize: "clamp(2.8rem, 5.2vw, 4.6rem)" }}
            >
              Ask the literature.
              <br />
              <span className="text-blue-ice/55">Verify every claim.</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.8, ease }}
              className="mt-10 max-w-[560px]"
            >
              <AskInput onSubmit={ask} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.8 }}
              className="mt-5 flex max-w-[560px] flex-col gap-1"
            >
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="group flex items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-[14px] text-blue-ice/65 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  {q}
                  <ArrowRight className="h-3.5 w-3.5 flex-none -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </button>
              ))}
            </motion.div>
          </div>

          <motion.figure
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 1, ease }}
            className="relative aspect-[4/3.2] w-full border border-navy-line bg-navy/60"
          >
            <Corners dark />
            <div className="label-dark absolute left-4 top-3.5 flex items-center gap-2">
              <span className="text-blue-bright">Fig. 01</span> Corpus field
            </div>
            <div className="label-dark absolute right-4 top-3.5">Live</div>
            <div className="absolute inset-x-0 bottom-0 top-9">{map && <HeroField map={map} />}</div>
            <figcaption className="absolute inset-x-0 bottom-0 flex justify-between border-t border-navy-line bg-navy-deep/60 px-4 py-2.5 text-[11.5px] text-blue-ice/60 backdrop-blur-sm">
              <span>N = {map?.n_papers ?? "—"}</span>
              <span>k = {map?.clusters.length ?? "—"}</span>
              <span>d = 384</span>
              <span className="hidden sm:inline">edges = {map?.edges.length ?? "—"}</span>
            </figcaption>
          </motion.figure>
        </div>
      </section>

      {/* ── Readouts ───────────────────────────────────────────────────────────── */}
      <section className="grid-paper border-b border-line">
        <div className="mx-auto grid max-w-page grid-cols-2 gap-y-10 px-5 py-14 sm:px-8 lg:grid-cols-4">
          {[
            { v: stats?.papers.toLocaleString(), u: "", c: "Papers indexed" },
            { v: stats?.chunks.toLocaleString(), u: "", c: "Evidence passages" },
            { v: map ? String(map.clusters.length) : undefined, u: "", c: "Research topics" },
            { v: "384", u: "dim", c: "Embedding space" },
          ].map((r, i) => (
            <div key={r.c} className={i > 0 ? "lg:border-l lg:border-line lg:pl-10" : ""}>
              <Readout value={r.v ?? <span className="skeleton inline-block h-10 w-24 rounded" />} unit={r.u} caption={r.c} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Method ─────────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-page px-5 py-24 sm:px-8">
        <SectionHead
          index="02"
          title="From question to verified answer"
          aside={
            <Link href="/method" className="btn-ghost">
              Method <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="mt-14">
          <PipelineDiagram stats={stats} />
        </div>
      </section>

      {/* ── Topics ─────────────────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-page px-5 py-24 sm:px-8">
          <SectionHead
            index="03"
            title="Twelve regions of the field"
            aside={
              <Link href="/atlas" className="btn-ghost">
                Open atlas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {topics.length === 0 &&
              Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-[220px]" />)}
            {map &&
              topics.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: (i % 4) * 0.06, duration: 0.5 }}
                  className="bg-surface"
                >
                  <Link href={`/topics/${t.id}`} className="group flex h-full flex-col p-5 transition-colors hover:bg-blue-soft">
                    <div className="h-[104px]">
                      <TopicThumb nodes={map.nodes} bounds={bounds} cluster={t.id} color={topicColor(t.id)} />
                    </div>
                    <div className="mt-4 flex items-start justify-between gap-3">
                      <span className="text-[15px] font-medium leading-snug">{t.label}</span>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 flex-none text-faint transition-colors group-hover:text-blue" />
                    </div>
                    <div className="mt-auto flex items-center gap-2 pt-3 text-[12px] text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: topicColor(t.id) }} />
                      {t.size} papers
                    </div>
                  </Link>
                </motion.div>
              ))}
          </div>
        </div>
      </section>

      {/* ── Library ────────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-page px-5 py-24 sm:px-8">
        <SectionHead
          index="04"
          title="Latest in the library"
          aside={
            <Link href="/library" className="btn-ghost">
              Library <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <ul className="mt-12 border-t border-ink">
          {!papers &&
            Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="border-b border-line py-5">
                <div className="skeleton h-4 rounded" style={{ width: `${80 - i * 7}%` }} />
              </li>
            ))}
          {latest.map((p) => (
            <li key={p.arxiv_id} className="border-b border-line">
              <a
                href={`https://arxiv.org/abs/${p.arxiv_id}`}
                target="_blank"
                rel="noreferrer"
                className="group grid grid-cols-[1fr_auto] items-baseline gap-x-8 gap-y-1 py-5 sm:grid-cols-[120px_1fr_110px_20px]"
              >
                <span className="hidden text-[12.5px] text-muted sm:block">{p.arxiv_id}</span>
                <span className="text-[16.5px] leading-snug text-ink-soft transition-colors group-hover:text-blue">
                  {p.title}
                </span>
                <span className="text-right text-[12.5px] text-faint">{formatDate(p.published_at)}</span>
                <ArrowUpRight className="hidden h-4 w-4 text-faint transition-colors group-hover:text-blue sm:block" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Call to action ─────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-page px-5 pb-24 sm:px-8">
        <div className="grid-navy relative overflow-hidden border border-navy bg-navy px-8 py-14 text-white sm:px-14">
          <Corners dark />
          <div className="flex flex-wrap items-center justify-between gap-8">
            <h2 className="max-w-[560px] text-[30px] font-light leading-[1.15] tracking-[-0.02em] sm:text-[40px]">
              Put a question to {stats ? stats.papers.toLocaleString() : "the"} papers.
            </h2>
            <Link href="/ask" className="btn-primary h-12 px-6 text-[15px]">
              Open console <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
