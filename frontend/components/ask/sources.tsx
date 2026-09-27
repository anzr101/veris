"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Citation } from "@/lib/types";

export function Sources({ citations, focused }: { citations: Citation[]; focused: number | null }) {
  // One row per paper, keeping every passage index that points at it.
  const papers = new Map<string, { c: Citation; indices: number[] }>();
  for (const c of citations) {
    const hit = papers.get(c.arxiv_id);
    if (hit) hit.indices.push(c.index);
    else papers.set(c.arxiv_id, { c, indices: [c.index] });
  }
  const rows = [...papers.values()];

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h3 className="label">Sources</h3>
        <span className="num font-mono text-[11px] text-faint">{rows.length}</span>
      </div>
      <ol className="mt-3 border-t border-line">
        {rows.map(({ c, indices }, i) => {
          const lit = focused !== null && indices.includes(focused);
          return (
            <motion.li
              key={c.arxiv_id}
              id={`source-${indices[0]}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.35 }}
              className="scroll-mt-24 border-b border-line"
            >
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className={clsx(
                  "group -mx-2 flex gap-3 rounded-lg px-2 py-3 transition-colors duration-200",
                  lit ? "bg-accent-soft" : "hover:bg-ink/[0.03]",
                )}
              >
                <span
                  className={clsx(
                    "num w-7 flex-none pt-[3px] font-mono text-[11px] transition-colors",
                    lit ? "text-accent" : "text-faint",
                  )}
                >
                  {indices.join(",")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[14px] leading-[1.4] text-ink">{c.paper_title}</span>
                  <span className="mt-1 flex items-center gap-1 font-mono text-[11px] text-muted">
                    {c.arxiv_id}
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </span>
              </a>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
