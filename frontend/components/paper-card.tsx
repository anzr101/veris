"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Paper } from "@/lib/types";

export function PaperCard({ paper, index }: { paper: Paper; index: number }) {
  const year = paper.published_at ? new Date(paper.published_at).getFullYear() : null;
  return (
    <motion.a
      href={`https://arxiv.org/abs/${paper.arxiv_id}`}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
      className="group flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5
                 transition-all hover:-translate-y-0.5 hover:border-signal/25 hover:bg-white/[0.03]"
    >
      <div className="mb-2 flex items-center justify-between font-mono text-[10.5px] text-mist">
        <span>{paper.arxiv_id}</span>
        {year && <span>{year}</span>}
      </div>
      <h3 className="font-display text-[17px] leading-snug text-bone group-hover:text-signal">
        {paper.title}
      </h3>
      <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-mist">{paper.abstract}</p>
      <div className="mt-auto flex items-center justify-between pt-4">
        <div className="flex flex-wrap gap-1.5">
          {paper.categories.slice(0, 3).map((c) => (
            <span
              key={c}
              className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-mist"
            >
              {c}
            </span>
          ))}
        </div>
        <ArrowUpRight className="h-4 w-4 text-mist opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </motion.a>
  );
}
