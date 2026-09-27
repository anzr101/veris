"use client";

import { useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { ClaimVerification, Contradiction } from "@/lib/types";

const STATUS = {
  supported: { label: "Supported", dot: "bg-ok", text: "text-ok" },
  partial: { label: "Partial", dot: "bg-warn", text: "text-warn" },
  unsupported: { label: "Unsupported", dot: "bg-bad", text: "text-bad" },
} as const;

/** Headline score plus one segment per claim, coloured by verdict. */
export function Faithfulness({ value, claims }: { value: number; claims: ClaimVerification[] }) {
  const counts = {
    supported: claims.filter((c) => c.status === "supported").length,
    partial: claims.filter((c) => c.status === "partial").length,
    unsupported: claims.filter((c) => c.status === "unsupported").length,
  };
  return (
    <section>
      <h3 className="label">Verified</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="num font-serif text-[56px] leading-none tracking-[-0.02em] text-ink">
          {Math.round(value * 100)}
        </span>
        <span className="font-serif text-[24px] text-muted">%</span>
      </div>
      <div className="mt-4 flex h-1.5 gap-[3px]">
        {claims.map((c, i) => (
          <motion.span
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
            className={clsx("flex-1 rounded-full", STATUS[c.status].dot)}
          />
        ))}
      </div>
      <div className="num mt-3 flex gap-4 font-mono text-[11px] text-muted">
        <span>{counts.supported} supported</span>
        {counts.partial > 0 && <span>{counts.partial} partial</span>}
        {counts.unsupported > 0 && <span>{counts.unsupported} unsupported</span>}
      </div>
    </section>
  );
}

export function Claims({ claims }: { claims: ClaimVerification[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h3 className="label">Claim-level verification</h3>
        <span className="num font-mono text-[11px] text-faint">{claims.length}</span>
      </div>
      <ul className="mt-3 border-t border-line">
        {claims.map((c, i) => {
          const s = STATUS[c.status];
          const isOpen = open === i;
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.5), duration: 0.35 }}
              className="border-b border-line"
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-start gap-3 py-3.5 text-left"
                aria-expanded={isOpen}
              >
                <span className={clsx("mt-[9px] h-1.5 w-1.5 flex-none rounded-full", s.dot)} />
                <span className="flex-1 text-[14.5px] leading-[1.55] text-ink-soft">{c.claim}</span>
                <span className="num mt-[3px] flex-none font-mono text-[11px] text-faint">
                  {c.citation_indices.length > 0 ? c.citation_indices.join(",") : "—"}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pb-4 pl-[18px] text-[13px] leading-[1.55] text-muted">
                      <span className={clsx("font-mono text-[11px] uppercase tracking-label", s.text)}>
                        {s.label} · {Math.round(c.confidence * 100)}%
                      </span>
                      {c.rationale && <p className="mt-1.5">{c.rationale}</p>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

export function Contradictions({ items }: { items: Contradiction[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h3 className="label">Where sources disagree</h3>
        <span className="num font-mono text-[11px] text-faint">{items.length}</span>
      </div>
      <ul className="mt-3 border-t border-line">
        {items.map((c, i) => (
          <li key={i} className="border-b border-line py-3.5">
            <div className="font-serif text-[18px] leading-snug text-ink">{c.topic}</div>
            <p className="mt-1 text-[14px] leading-[1.55] text-muted">{c.summary}</p>
            {c.arxiv_ids.length > 0 && (
              <div className="mt-2 font-mono text-[11px] text-faint">{c.arxiv_ids.join("  ·  ")}</div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
