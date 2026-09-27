"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Maximize2, Minus, Plus, X } from "lucide-react";
import type { MapArtifact, MapNode, Paper } from "@/lib/types";
import { getPaper } from "@/lib/api";
import { topicColor } from "@/lib/palette";
import { ease } from "@/lib/motion";
import { AtlasCanvas, type AtlasHandle } from "./atlas-canvas";

export function AtlasView({ artifact, focusArxiv }: { artifact: MapArtifact; focusArxiv?: string[] }) {
  const canvas = useRef<AtlasHandle>(null);
  const [hovered, setHovered] = useState<MapNode | null>(null);
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [topic, setTopic] = useState<number | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);

  const highlight = useMemo(() => {
    if (!focusArxiv?.length) return null;
    const ids = new Set(focusArxiv);
    return new Set(artifact.nodes.filter((n) => ids.has(n.arxiv_id)).map((n) => n.paper_id));
  }, [focusArxiv, artifact.nodes]);

  useEffect(() => {
    setPaper(null);
    if (!selected) return;
    let live = true;
    getPaper(selected.arxiv_id).then((p) => live && setPaper(p ?? null));
    return () => {
      live = false;
    };
  }, [selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setTopic(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const clusters = useMemo(() => [...artifact.clusters].sort((a, b) => b.size - a.size), [artifact.clusters]);

  return (
    <div className="relative h-[calc(100svh-4rem)] w-full overflow-hidden">
      <AtlasCanvas
        ref={canvas}
        nodes={artifact.nodes}
        clusters={artifact.clusters}
        edges={artifact.edges}
        highlight={highlight}
        topic={topic}
        selectedId={selected?.paper_id ?? null}
        onHover={setHovered}
        onSelect={setSelected}
      />

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="pointer-events-none absolute left-[max(1.25rem,calc((100vw-1180px)/2+2rem))] top-6"
      >
        <h1 className="font-serif text-[44px] leading-none tracking-[-0.02em]">Atlas</h1>
        <p className="num mt-2 font-mono text-[11.5px] text-muted">
          {artifact.n_papers.toLocaleString()} papers · {artifact.clusters.length} topics
          {highlight && highlight.size > 0 && <span className="text-accent"> · {highlight.size} cited</span>}
        </p>
      </motion.div>

      {/* Topics */}
      <motion.nav
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.25, duration: 0.6, ease }}
        className="absolute bottom-6 left-[max(1.25rem,calc((100vw-1180px)/2+2rem))] hidden w-[290px] rounded-xl bg-paper/80 p-1 backdrop-blur-sm md:block"
        aria-label="Topics"
      >
        <ul className="space-y-px">
          {clusters.map((c) => {
            const on = topic === c.id;
            const dim = topic !== null && !on;
            return (
              <li key={c.id}>
                <button
                  onClick={() => setTopic(on ? null : c.id)}
                  className={clsx(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-[5px] text-left text-[13px] transition-all duration-200",
                    on ? "bg-ink/[0.06] text-ink" : "text-ink-soft hover:bg-ink/[0.04]",
                    dim && "opacity-40",
                  )}
                >
                  <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: topicColor(c.id) }} />
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="num font-mono text-[10.5px] text-faint">{c.size}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </motion.nav>

      {/* Zoom */}
      <div className="absolute bottom-6 right-[max(1.25rem,calc((100vw-1180px)/2+2rem))] flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-field">
        {[
          { icon: Plus, label: "Zoom in", fn: () => canvas.current?.zoom(1.5) },
          { icon: Minus, label: "Zoom out", fn: () => canvas.current?.zoom(1 / 1.5) },
          { icon: Maximize2, label: "Fit", fn: () => canvas.current?.reset() },
        ].map(({ icon: Icon, label, fn }, i) => (
          <button
            key={label}
            onClick={fn}
            aria-label={label}
            title={label}
            className={clsx(
              "flex h-9 w-9 items-center justify-center text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink",
              i > 0 && "border-t border-line",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      {/* Hover label */}
      <AnimatePresence>
        {hovered && hovered.paper_id !== selected?.paper_id && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute left-1/2 top-6 w-[min(460px,70vw)] -translate-x-1/2 rounded-xl border border-line bg-surface/95 px-4 py-3 text-center shadow-float backdrop-blur"
          >
            <div className="flex items-center justify-center gap-2 font-mono text-[10.5px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: topicColor(hovered.cluster) }} />
              {hovered.arxiv_id}
            </div>
            <div className="mt-1 text-[14px] leading-snug text-ink">{hovered.title}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paper */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key={selected.paper_id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.3, ease }}
            className="absolute bottom-24 top-6 flex w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float right-[max(1.25rem,calc((100vw-1180px)/2+2rem))]"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: topicColor(selected.cluster) }} />
                {artifact.clusters.find((c) => c.id === selected.cluster)?.label}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="-mr-1 rounded-md p-1 text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="font-mono text-[11px] text-muted">arXiv:{selected.arxiv_id}</div>
              <h2 className="mt-2 font-serif text-[25px] leading-[1.12] text-ink">{selected.title}</h2>
              {paper ? (
                <>
                  {paper.authors.length > 0 && (
                    <p className="mt-3 text-[13px] leading-snug text-muted">
                      {paper.authors.slice(0, 4).join(", ")}
                      {paper.authors.length > 4 && ` +${paper.authors.length - 4}`}
                    </p>
                  )}
                  <p className="mt-5 text-[14px] leading-[1.65] text-ink-soft">{paper.abstract}</p>
                </>
              ) : (
                <div className="mt-5 space-y-2.5">
                  {[100, 96, 90, 98, 60].map((w, i) => (
                    <div key={i} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 border-t border-line px-5 py-4">
              <Link
                href={`/?q=${encodeURIComponent(`What does the paper "${selected.title}" contribute, and how does it compare to related work?`)}`}
                className="flex-1 rounded-full bg-ink px-4 py-2 text-center text-[13.5px] text-paper transition-colors hover:bg-accent"
              >
                Ask about this paper
              </Link>
              <a
                href={`https://arxiv.org/abs/${selected.arxiv_id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-2 text-[13.5px] text-ink transition-colors hover:border-ink/30"
              >
                arXiv <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
