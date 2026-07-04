"use client";

import { motion } from "framer-motion";

function band(v: number) {
  if (v >= 0.66) return { label: "Open frontier", color: "#3ee6c4" };
  if (v >= 0.4) return { label: "Emerging space", color: "#f5c46b" };
  return { label: "Crowded area", color: "#f0707f" };
}

export function NoveltyGauge({
  novelty,
  density,
  crowded,
}: {
  novelty: number;
  density: number;
  crowded: number;
}) {
  const pct = Math.round(novelty * 100);
  const b = band(novelty);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="kicker mb-1">Novelty</div>
          <div className="flex items-end gap-2">
            <span className="font-display text-5xl tracking-tight" style={{ color: b.color }}>
              {pct}
            </span>
            <span className="mb-1.5 font-mono text-xs text-mist">/ 100</span>
          </div>
          <div className="mt-1 font-mono text-[12px]" style={{ color: b.color }}>
            {b.label}
          </div>
        </div>
        <div className="text-right font-mono text-[11px] text-mist">
          <div>density · {Math.round(density * 100)}%</div>
          <div>{crowded} close neighbors</div>
        </div>
      </div>

      {/* Frontier bar: crowded → open */}
      <div className="relative mt-5 h-2 rounded-full bg-gradient-to-r from-rose/50 via-amber/50 to-signal/60">
        <motion.div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-ink"
          style={{ background: b.color, boxShadow: `0 0 12px ${b.color}` }}
          initial={{ left: "0%" }}
          animate={{ left: `calc(${pct}% - 8px)` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-mist">
        <span>crowded</span>
        <span>open frontier</span>
      </div>
    </div>
  );
}
