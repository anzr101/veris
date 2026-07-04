"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Citation } from "@/lib/types";

export function Sources({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <section>
      <div className="kicker mb-3">Sources · {citations.length}</div>
      <ol className="space-y-2">
        {citations.map((c, i) => (
          <motion.li
            key={c.chunk_id}
            id={`source-${c.index}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="group scroll-mt-24 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3
                       transition-colors hover:border-signal/25"
          >
            <a href={c.url} target="_blank" rel="noreferrer" className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md
                               border border-signal/30 bg-signal/10 font-mono text-[10px] text-signal">
                {c.index}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-[14px] text-bone group-hover:text-signal">
                  {c.paper_title}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] text-mist">
                  {c.arxiv_id} · {c.section}
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </span>
            </a>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
