"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { AlertTriangle, CircleSlash, ShieldCheck } from "lucide-react";
import type { ClaimVerification, Contradiction } from "@/lib/types";

const STATUS = {
  supported: { icon: ShieldCheck, color: "text-signal", label: "Supported", ring: "border-signal/25" },
  partial: { icon: AlertTriangle, color: "text-amber", label: "Partial", ring: "border-amber/25" },
  unsupported: { icon: CircleSlash, color: "text-rose", label: "Unsupported", ring: "border-rose/30" },
} as const;

export function Verification({ claims }: { claims: ClaimVerification[] }) {
  if (claims.length === 0) return null;
  return (
    <section>
      <div className="kicker mb-3">Claim verification · {claims.length}</div>
      <ul className="space-y-2">
        {claims.map((claim, i) => {
          const s = STATUS[claim.status];
          const Icon = s.icon;
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
              className={clsx("rounded-xl border bg-white/[0.02] p-3", s.ring)}
            >
              <div className="flex items-start gap-2.5">
                <Icon className={clsx("mt-0.5 h-4 w-4 flex-none", s.color)} />
                <div className="min-w-0">
                  <p className="text-[13.5px] leading-snug text-bone/90">{claim.claim}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-mist">
                    <span className={s.color}>{s.label}</span>
                    <span>confidence {Math.round(claim.confidence * 100)}%</span>
                    {claim.citation_indices.length > 0 && (
                      <span>cites [{claim.citation_indices.join("][")}]</span>
                    )}
                  </div>
                </div>
              </div>
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
      <div className="kicker mb-3 text-amber/80">Contradictions detected · {items.length}</div>
      <ul className="space-y-2">
        {items.map((c, i) => (
          <li key={i} className="rounded-xl border border-amber/25 bg-amber/[0.04] p-3">
            <div className="font-display text-[14px] text-bone">{c.topic}</div>
            <p className="mt-1 text-[13px] leading-snug text-mist">{c.summary}</p>
            {c.arxiv_ids.length > 0 && (
              <div className="mt-1.5 font-mono text-[10.5px] text-amber/70">
                {c.arxiv_ids.join(" · ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
