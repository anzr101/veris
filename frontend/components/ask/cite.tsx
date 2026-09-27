"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Citation } from "@/lib/types";

export function Cite({
  index,
  citation,
  onFocus,
}: {
  index: number;
  citation?: Citation;
  onFocus?: (i: number | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const show = (v: boolean) => {
    setOpen(v);
    onFocus?.(v ? index : null);
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => show(true)}
      onMouseLeave={() => show(false)}
    >
      <a
        href={citation ? `#source-${index}` : undefined}
        onFocus={() => show(true)}
        onBlur={() => show(false)}
        className="mx-[1px] inline-flex -translate-y-[0.45em] items-center justify-center rounded-[4px] px-[3px] font-mono text-[10.5px] font-medium leading-none text-accent transition-colors hover:bg-accent hover:text-paper"
      >
        {index}
      </a>

      <AnimatePresence>
        {open && citation && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full left-1/2 z-50 mb-1 block w-[320px] -translate-x-1/2 pb-1"
          >
            <span className="block rounded-xl border border-line bg-surface p-4 text-left shadow-float">
              <span className="flex items-center justify-between font-mono text-[10.5px] text-muted">
                <span>arXiv:{citation.arxiv_id}</span>
                <span className="uppercase tracking-label">{citation.section}</span>
              </span>
              <span className="mt-2 block font-serif text-[17px] leading-[1.25] text-ink">
                {citation.paper_title}
              </span>
              <span className="mt-2 line-clamp-4 block border-l border-accent/40 pl-3 text-[13px] leading-[1.55] text-muted">
                {citation.snippet}
              </span>
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
