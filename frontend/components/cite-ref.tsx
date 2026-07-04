"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Citation } from "@/lib/types";

export function CiteRef({ index, citation }: { index: number; citation?: Citation }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-block align-baseline"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <sup>
        <a
          href={citation ? `#source-${index}` : undefined}
          className="mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-[6px]
                     border border-signal/30 bg-signal/10 px-1 font-mono text-[10px] font-medium
                     text-signal transition-colors hover:border-signal/70 hover:bg-signal/20"
        >
          {index}
        </a>
      </sup>

      <AnimatePresence>
        {open && citation && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full left-1/2 z-50 mb-2 w-80 -translate-x-1/2"
          >
            <span className="glass block rounded-xl p-3.5 shadow-lift">
              <span className="mb-1.5 flex items-center justify-between">
                <span className="kicker">{citation.section}</span>
                <span className="font-mono text-[10px] text-mist">{citation.arxiv_id}</span>
              </span>
              <span className="block font-display text-[15px] leading-snug text-bone">
                {citation.paper_title}
              </span>
              <span className="mt-1.5 block text-[12.5px] leading-relaxed text-mist">
                “{citation.snippet}”
              </span>
              <a
                href={citation.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 inline-flex items-center gap-1 font-mono text-[11px] text-signal hover:underline"
              >
                arxiv.org/abs/{citation.arxiv_id}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
