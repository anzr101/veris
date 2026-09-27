"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Search } from "lucide-react";
import { getAllPapers } from "@/lib/api";
import type { Paper } from "@/lib/types";
import { ease } from "@/lib/motion";

const PAGE = 40;

export default function PapersPage() {
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    getAllPapers().then(setPapers).catch(() => setPapers([]));
  }, []);

  // Most common primary categories, as filters.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of papers ?? []) {
      const c = p.categories[0];
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [papers]);

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (papers ?? []).filter((p) => {
      if (category && !p.categories.includes(category)) return false;
      if (terms.length === 0) return true;
      const hay = `${p.title} ${p.abstract} ${p.authors.join(" ")} ${p.arxiv_id}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [papers, query, category]);

  useEffect(() => setShown(PAGE), [query, category]);

  return (
    <div className="mx-auto w-full max-w-page px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div>
          <h1 className="font-serif text-[56px] leading-none tracking-[-0.02em] sm:text-[72px]">Papers</h1>
          <p className="num mt-3 font-mono text-[11.5px] text-muted">
            {papers ? `${papers.length.toLocaleString()} indexed from arXiv` : " "}
          </p>
        </div>
        <label className="flex w-full items-center gap-2.5 border-b border-line pb-2 transition-colors focus-within:border-ink sm:w-[340px]">
          <Search className="h-4 w-4 flex-none text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, abstract, author"
            className="w-full bg-transparent text-[15px] text-ink placeholder:text-faint focus:outline-none"
          />
          {query && <span className="num flex-none font-mono text-[11px] text-muted">{filtered.length}</span>}
        </label>
      </motion.header>

      {categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mt-10 flex flex-wrap gap-1.5"
        >
          {[["All", null] as const, ...categories.map(([c]) => [c, c] as const)].map(([label, value]) => (
            <button
              key={label}
              onClick={() => setCategory(value)}
              className={clsx(
                "rounded-full px-3 py-1 font-mono text-[11.5px] transition-colors duration-200",
                category === value ? "bg-ink text-paper" : "text-muted hover:bg-ink/[0.05] hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </motion.div>
      )}

      <div className="mt-6 border-t border-ink/80">
        {!papers &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-6 border-b border-line py-5">
              <div className="skeleton h-3.5 w-20 rounded" />
              <div className="skeleton h-3.5 flex-1 rounded" style={{ maxWidth: `${70 - i * 4}%` }} />
            </div>
          ))}

        {papers && filtered.length === 0 && (
          <p className="py-16 text-center font-serif text-[22px] text-muted">No papers match.</p>
        )}

        <ul>
          {filtered.slice(0, shown).map((p, i) => {
            const isOpen = open === p.arxiv_id;
            const date = p.published_at
              ? new Date(p.published_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
              : "";
            return (
              <motion.li
                key={p.arxiv_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min((i % PAGE) * 0.015, 0.4), duration: 0.3 }}
                className="border-b border-line"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : p.arxiv_id)}
                  aria-expanded={isOpen}
                  className="group grid w-full grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-5 text-left sm:grid-cols-[110px_1fr_90px_96px]"
                >
                  <span className="num hidden font-mono text-[11.5px] text-muted sm:block">{p.arxiv_id}</span>
                  <span
                    className={clsx(
                      "font-serif text-[20px] leading-[1.25] transition-colors duration-200",
                      isOpen ? "text-ink" : "text-ink-soft group-hover:text-ink",
                    )}
                  >
                    {p.title}
                  </span>
                  <span className="hidden font-mono text-[11px] text-muted sm:block">{p.categories[0]}</span>
                  <span className="num text-right font-mono text-[11px] text-faint">{date}</span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease }}
                      className="overflow-hidden"
                    >
                      <div className="grid gap-x-6 pb-7 sm:grid-cols-[110px_1fr_90px_96px]">
                        <span />
                        <div className="max-w-read">
                          <p className="text-[13px] text-muted">{p.authors.join(", ")}</p>
                          <p className="mt-4 text-[15px] leading-[1.7] text-ink-soft">{p.abstract}</p>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <Link
                              href={`/?q=${encodeURIComponent(`What does the paper "${p.title}" contribute, and how does it compare to related work?`)}`}
                              className="rounded-full bg-ink px-4 py-1.5 text-[13px] text-paper transition-colors hover:bg-accent"
                            >
                              Ask about this paper
                            </Link>
                            <a
                              href={`https://arxiv.org/abs/${p.arxiv_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-1.5 text-[13px] text-ink transition-colors hover:border-ink/30"
                            >
                              arXiv <ArrowUpRight className="h-3 w-3" />
                            </a>
                            {p.pdf_url && (
                              <a
                                href={p.pdf_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-1.5 text-[13px] text-ink transition-colors hover:border-ink/30"
                              >
                                PDF <ArrowUpRight className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>

        {filtered.length > shown && (
          <div className="flex justify-center pt-10">
            <button
              onClick={() => setShown((s) => s + PAGE)}
              className="num rounded-full border border-line px-5 py-2 font-mono text-[12px] text-muted transition-colors hover:border-ink/30 hover:text-ink"
            >
              Show more · {filtered.length - shown} remaining
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
