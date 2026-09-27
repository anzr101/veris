"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Maximize2, Minus, Plus, X } from "lucide-react";
import type { MapArtifact, MapNode, Paper } from "@/lib/types";
import { getPaper } from "@/lib/api";
import { askAbout, formatDate } from "@/lib/corpus";
import { topicColor } from "@/lib/palette";
import { ease } from "@/lib/motion";
import { Corners } from "@/components/ui";
import { AtlasCanvas, type AtlasHandle } from "./atlas-canvas";

const L = "left-[max(1.25rem,calc((100vw-1240px)/2+2rem))]";
const R = "right-[max(1.25rem,calc((100vw-1240px)/2+2rem))]";

export function AtlasView({
  artifact,
  focusArxiv,
  initialTopic = null,
}: {
  artifact: MapArtifact;
  focusArxiv?: string[];
  initialTopic?: number | null;
}) {
  const canvas = useRef<AtlasHandle>(null);
  const [hovered, setHovered] = useState<MapNode | null>(null);
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [topic, setTopic] = useState<number | null>(initialTopic);
  const [paper, setPaper] = useState<Paper | null>(null);

  useEffect(() => setTopic(initialTopic), [initialTopic]);

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
  const semantic = artifact.edges.filter((e) => e.kind === "semantic").length;

  return (
    <div className="grid-navy relative h-[calc(100svh-4rem)] w-full overflow-hidden bg-navy-deep text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_600px_at_60%_50%,rgba(31,79,216,0.22),transparent_70%)]" />
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

      {/* Title + readouts */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className={clsx("pointer-events-none absolute top-7", L)}
      >
        <div className="label-dark flex items-center gap-3">
          <span className="text-blue-bright">Fig. 02</span>
          <span className="h-px w-8 bg-navy-line" />
        </div>
        <h1 className="mt-3 text-[40px] font-light leading-none tracking-[-0.03em]">Atlas</h1>
        <div className="mt-4 flex gap-6 text-[12px] text-blue-ice/60">
          <span>
            <span className="text-white">{artifact.n_papers}</span> papers
          </span>
          <span>
            <span className="text-white">{artifact.clusters.length}</span> topics
          </span>
          <span>
            <span className="text-white">{semantic}</span> links
          </span>
          {highlight && highlight.size > 0 && <span className="text-blue-bright">{highlight.size} cited</span>}
        </div>
      </motion.div>

      {/* Topic filter */}
      <motion.nav
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.25, duration: 0.6, ease }}
        className={clsx(
          "absolute bottom-6 hidden w-[290px] border border-navy-line bg-navy-deep/75 p-1.5 backdrop-blur-md md:block",
          L,
        )}
        aria-label="Topics"
      >
        <Corners dark />
        <div className="label-dark px-2 pb-1.5 pt-1">Topics</div>
        <ul className="space-y-px">
          {clusters.map((c) => {
            const on = topic === c.id;
            const dim = topic !== null && !on;
            return (
              <li key={c.id}>
                <button
                  onClick={() => setTopic(on ? null : c.id)}
                  className={clsx(
                    "flex w-full items-center gap-2.5 px-2 py-[5px] text-left text-[12.5px] transition-all duration-200",
                    on ? "bg-blue/25 text-white" : "text-blue-ice/75 hover:bg-white/[0.05] hover:text-white",
                    dim && "opacity-40",
                  )}
                >
                  <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: topicColor(c.id) }} />
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="text-[11px] text-blue-ice/40">{c.size}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </motion.nav>

      {/* Zoom */}
      <div className={clsx("absolute bottom-6 flex flex-col border border-navy-line bg-navy-deep/75 backdrop-blur-md", R)}>
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
              "flex h-9 w-9 items-center justify-center text-blue-ice/70 transition-colors hover:bg-white/[0.06] hover:text-white",
              i > 0 && "border-t border-navy-line",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      {/* Hover readout */}
      <AnimatePresence>
        {hovered && hovered.paper_id !== selected?.paper_id && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute left-1/2 top-7 w-[min(460px,70vw)] -translate-x-1/2 border border-navy-line bg-navy-deep/90 px-4 py-3 text-center backdrop-blur-md"
          >
            <div className="flex items-center justify-center gap-2 text-[11px] text-blue-ice/60">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: topicColor(hovered.cluster) }} />
              arXiv:{hovered.arxiv_id}
            </div>
            <div className="mt-1 text-[14px] leading-snug text-white">{hovered.title}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Specimen panel */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key={selected.paper_id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.3, ease }}
            className={clsx(
              "absolute bottom-24 top-7 flex w-[min(390px,calc(100vw-2.5rem))] flex-col bg-surface text-ink shadow-float",
              R,
            )}
          >
            <Corners />
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="flex items-center gap-2 text-[11.5px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: topicColor(selected.cluster) }} />
                {artifact.clusters.find((c) => c.id === selected.cluster)?.label}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="-mr-1 rounded p-1 text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="flex justify-between text-[11.5px] text-muted">
                <span>arXiv:{selected.arxiv_id}</span>
                {paper && <span>{formatDate(paper.published_at)}</span>}
              </div>
              <h2 className="mt-2 text-[20px] font-medium leading-[1.25] tracking-[-0.01em]">{selected.title}</h2>
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
              <Link href={askAbout(selected.title)} className="btn-primary flex-1">
                Ask about this paper
              </Link>
              <a href={`https://arxiv.org/abs/${selected.arxiv_id}`} target="_blank" rel="noreferrer" className="btn-ghost">
                arXiv <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
