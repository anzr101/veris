"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Users } from "lucide-react";
import type { Collaborator } from "@/lib/types";

export function Collaborators({ items }: { items: Collaborator[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="kicker mb-1 flex items-center gap-1.5">
        <Users className="h-3 w-3" /> Adjacent researchers · {items.length}
      </div>
      <p className="mb-3 text-[11px] leading-snug text-mist/70">
        Surfaced from public arXiv authorship on the nearest work. Public profiles only, no
        contact details.
      </p>
      <ul className="space-y-2">
        {items.map((c, i) => (
          <motion.li
            key={c.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.3) }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-display text-[15px] text-bone">{c.name}</span>
              <span className="flex-none font-mono text-[10px] text-mist">
                {c.paper_count} near
              </span>
            </div>
            {c.affiliation && (
              <div className="mt-0.5 text-[11.5px] text-mist">{c.affiliation}</div>
            )}
            <ul className="mt-1.5 space-y-0.5">
              {c.sample_papers.map((p) => (
                <li key={p.arxiv_id} className="truncate text-[11.5px] text-mist/80">
                  · {p.title}
                </li>
              ))}
            </ul>
            <a
              href={c.profile_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-mono text-[10.5px] text-signal hover:underline"
            >
              public profile <ArrowUpRight className="h-3 w-3" />
            </a>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
