"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, GitFork, RotateCcw, X } from "lucide-react";
import type { MapArtifact, MapNode } from "@/lib/types";
import { easeOutExpo } from "@/lib/motion";
import { MapCanvas } from "./map-canvas";

export function MapView({ artifact, focusArxiv }: { artifact: MapArtifact; focusArxiv?: string[] }) {
  const years = useMemo(
    () => artifact.nodes.map((n) => n.year).filter((y): y is number => y !== null),
    [artifact.nodes],
  );

  // When arriving from Ask's "show sources on map", highlight that neighborhood.
  const highlight = useMemo(() => {
    if (!focusArxiv || focusArxiv.length === 0) return null;
    const ids = new Set(focusArxiv);
    return new Set(
      artifact.nodes.filter((n) => ids.has(n.arxiv_id)).map((n) => n.paper_id),
    );
  }, [focusArxiv, artifact.nodes]);
  const minYear = years.length ? Math.min(...years) : 0;
  const maxYearAll = years.length ? Math.max(...years) : 0;

  const [maxYear, setMaxYear] = useState<number>(maxYearAll);
  const [showEdges, setShowEdges] = useState(true);
  const [hovered, setHovered] = useState<MapNode | null>(null);
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => setMaxYear(maxYearAll), [maxYearAll]);

  const showSlider = years.length > 1;

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden">
      <MapCanvas
        key={resetKey}
        nodes={artifact.nodes}
        clusters={artifact.clusters}
        edges={artifact.edges}
        maxYear={showSlider ? maxYear : null}
        showEdges={showEdges}
        highlight={highlight}
        selectedId={selected?.paper_id ?? null}
        onHover={setHovered}
        onSelect={setSelected}
      />

      {/* Top-left: title + stats */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOutExpo }}
        className="pointer-events-none absolute left-5 top-5"
      >
        <div className="kicker mb-1.5">The map of science</div>
        <h1 className="font-display text-3xl tracking-tight">Research landscape</h1>
        <p className="mt-1 font-mono text-[11px] text-mist">
          {artifact.n_papers.toLocaleString()} papers · {artifact.clusters.length} topics ·
          drag to pan · scroll to zoom
        </p>
      </motion.div>

      {/* Top-right: controls */}
      <div className="absolute right-5 top-5 flex gap-2">
        <button
          onClick={() => setShowEdges((v) => !v)}
          className={`chip ${showEdges ? "border-signal/40 text-bone" : ""}`}
        >
          <GitFork className="h-3.5 w-3.5" />
          {showEdges ? "Edges on" : "Edges off"}
        </button>
        <button onClick={() => setResetKey((k) => k + 1)} className="chip" title="Reset view">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: easeOutExpo }}
        className="glass absolute bottom-24 left-5 max-h-[40vh] w-60 overflow-auto rounded-2xl p-4"
      >
        <div className="kicker mb-3">Topics</div>
        <ul className="space-y-2">
          {artifact.clusters.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <span
                className="mt-1 h-2.5 w-2.5 flex-none rounded-full"
                style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }}
              />
              <div className="min-w-0">
                <div className="truncate text-[13px] text-bone">{c.label}</div>
                <div className="font-mono text-[10px] text-mist">{c.size} papers</div>
              </div>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Time slider */}
      {showSlider && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: easeOutExpo }}
          className="glass absolute bottom-6 left-1/2 flex w-[min(560px,90vw)] -translate-x-1/2
                     items-center gap-4 rounded-2xl px-5 py-3"
        >
          <span className="kicker flex-none">Timeline</span>
          <span className="flex-none font-mono text-xs tabular-nums text-mist">{minYear}</span>
          <input
            type="range"
            min={minYear}
            max={maxYearAll}
            value={maxYear}
            onChange={(e) => setMaxYear(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10
                       accent-signal [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5"
          />
          <span className="w-12 flex-none text-right font-mono text-sm tabular-nums text-signal">
            {maxYear}
          </span>
        </motion.div>
      )}

      {/* Hover card */}
      <AnimatePresence>
        {hovered && !selected && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="glass pointer-events-none absolute left-1/2 top-5 w-[min(440px,80vw)]
                       -translate-x-1/2 rounded-xl p-3 text-center"
          >
            <div className="font-mono text-[10px] text-mist">{hovered.arxiv_id}</div>
            <div className="mt-0.5 font-display text-[15px] text-bone">{hovered.title}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected detail */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.25, ease: easeOutExpo }}
            className="glass absolute right-5 top-20 w-[min(360px,88vw)] rounded-2xl p-5 shadow-lift"
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute right-3 top-3 text-mist hover:text-bone"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="kicker mb-2">{selected.arxiv_id}</div>
            <h2 className="font-display text-lg leading-snug text-bone">{selected.title}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.categories.map((c) => (
                <span key={c} className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-mist">
                  {c}
                </span>
              ))}
            </div>
            <a
              href={`https://arxiv.org/abs/${selected.arxiv_id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2
                         text-sm text-bone transition-colors hover:bg-white/[0.1]"
            >
              Open on arXiv <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
