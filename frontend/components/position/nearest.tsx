"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { ScoredPaper } from "@/lib/types";

export function NearestWork({ papers }: { papers: ScoredPaper[] }) {
  if (papers.length === 0) return null;
  const max = Math.max(...papers.map((p) => p.score), 0.0001);
  return (
    <section>
      <div className="kicker mb-3">Nearest prior work · {papers.length}</div>
      <ul className="space-y-2">
        {papers.map((p, i) => (
          <motion.li
            key={p.arxiv_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-signal/25"
          >
            <a href={p.url} target="_blank" rel="noreferrer" className="block">
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-mist">
                <span>{p.arxiv_id}{p.year ? ` · ${p.year}` : ""}</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="mt-0.5 font-display text-[14px] leading-snug text-bone group-hover:text-signal">
                {p.title}
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-signal/60"
                  style={{ width: `${Math.round((p.score / max) * 100)}%` }}
                />
              </div>
            </a>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
