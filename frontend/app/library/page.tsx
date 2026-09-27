"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Search } from "lucide-react";
import { getAllPapers, getMap } from "@/lib/api";
import type { MapArtifact, Paper } from "@/lib/types";
import { askAbout, formatDate, topicsFrom } from "@/lib/corpus";
import { topicColor } from "@/lib/palette";
import { ease } from "@/lib/motion";
import { PageHead } from "@/components/ui";

const PAGE = 40;
type Sort = "newest" | "oldest" | "title";

export default function LibraryPage() {
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [map, setMap] = useState<MapArtifact | null>(null);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("newest");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    getAllPapers().then(setPapers).catch(() => setPapers([]));
    getMap().then(setMap).catch(() => {});
  }, []);

  const topicOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of map?.nodes ?? []) m.set(n.arxiv_id, n.cluster);
    return m;
  }, [map]);
  const topics = useMemo(() => (map ? topicsFrom(map) : []), [map]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of papers ?? []) {
      const c = p.categories[0];
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [papers]);

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const out = (papers ?? []).filter((p) => {
      if (category && !p.categories.includes(category)) return false;
      if (topic !== null && topicOf.get(p.arxiv_id) !== topic) return false;
      if (terms.length === 0) return true;
      const hay = `${p.title} ${p.abstract} ${p.authors.join(" ")} ${p.arxiv_id}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    return out.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const d = (a.published_at ?? "").localeCompare(b.published_at ?? "");
      return sort === "newest" ? -d : d;
    });
  }, [papers, query, category, topic, topicOf, sort]);

  useEffect(() => setShown(PAGE), [query, category, topic, sort]);

  return (
    <div className="mx-auto w-full max-w-page flex-1 px-5 pb-24 pt-14 sm:px-8">
      <PageHead index="05" title="Library" meta={papers ? `${papers.length} papers from arXiv` : undefined} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
        {/* Filters */}
        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <label className="flex items-center gap-2.5 border-b border-line pb-2 transition-colors focus-within:border-blue">
            <Search className="h-4 w-4 flex-none text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, abstract, author"
              className="w-full bg-transparent text-[14.5px] text-ink placeholder:text-faint focus:outline-none"
            />
          </label>

          <div>
            <div className="label">Sort</div>
            <div className="mt-3 flex border border-line bg-surface p-0.5">
              {(["newest", "oldest", "title"] as Sort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={clsx(
                    "flex-1 py-1.5 text-[12.5px] capitalize transition-colors",
                    sort === s ? "bg-navy text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {topics.length > 0 && (
            <div className="hidden lg:block">
              <div className="label">Topic</div>
              <ul className="mt-3 space-y-px">
                {topics.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setTopic(topic === t.id ? null : t.id)}
                      className={clsx(
                        "flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-[13px] transition-colors",
                        topic === t.id ? "bg-blue-soft text-blue" : "text-ink-soft hover:bg-ink/[0.03]",
                      )}
                    >
                      <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: topicColor(t.id) }} />
                      <span className="flex-1 truncate">{t.label}</span>
                      <span className="text-[11px] text-faint">{t.size}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {categories.length > 0 && (
            <div>
              <div className="label">Category</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {categories.map(([c, n]) => (
                  <button
                    key={c}
                    onClick={() => setCategory(category === c ? null : c)}
                    className={clsx(
                      "border px-2 py-1 text-[12px] transition-colors",
                      category === c
                        ? "border-navy bg-navy text-white"
                        : "border-line bg-surface text-ink-soft hover:border-blue/40",
                    )}
                  >
                    {c} <span className={category === c ? "text-blue-ice/70" : "text-faint"}>{n}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Results */}
        <div className="min-w-0">
          <div className="flex items-center justify-between pb-3 text-[12.5px] text-muted">
            <span>{papers ? `${filtered.length} results` : "Loading"}</span>
            {(query || topic !== null || category) && (
              <button
                onClick={() => {
                  setQuery("");
                  setTopic(null);
                  setCategory(null);
                }}
                className="text-blue hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
          <div className="border-t border-ink">
            {!papers &&
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-6 border-b border-line py-5">
                  <div className="skeleton h-3.5 w-20 rounded" />
                  <div className="skeleton h-3.5 flex-1 rounded" style={{ maxWidth: `${70 - i * 4}%` }} />
                </div>
              ))}

            {papers && filtered.length === 0 && (
              <p className="py-16 text-center text-[18px] font-light text-muted">No papers match.</p>
            )}

            <ul>
              {filtered.slice(0, shown).map((p, i) => {
                const isOpen = open === p.arxiv_id;
                const t = topicOf.get(p.arxiv_id);
                return (
                  <motion.li
                    key={p.arxiv_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min((i % PAGE) * 0.012, 0.35), duration: 0.3 }}
                    className="border-b border-line"
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : p.arxiv_id)}
                      aria-expanded={isOpen}
                      className="group grid w-full grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-4 text-left sm:grid-cols-[104px_1fr_96px]"
                    >
                      <span className="hidden items-center gap-2 text-[12px] text-muted sm:flex">
                        {t !== undefined && (
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: topicColor(t) }} />
                        )}
                        {p.arxiv_id}
                      </span>
                      <span
                        className={clsx(
                          "text-[15.5px] leading-[1.4] transition-colors duration-200",
                          isOpen ? "text-blue" : "text-ink group-hover:text-blue",
                        )}
                      >
                        {p.title}
                      </span>
                      <span className="text-right text-[12px] text-faint">{formatDate(p.published_at)}</span>
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
                          <div className="grid gap-x-6 pb-6 sm:grid-cols-[104px_1fr_96px]">
                            <span />
                            <div className="max-w-read">
                              <p className="text-[13px] text-muted">{p.authors.join(", ")}</p>
                              <p className="mt-3 text-[14.5px] leading-[1.7] text-ink-soft">{p.abstract}</p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {p.categories.map((c) => (
                                  <span key={c} className="border border-line px-1.5 py-0.5 text-[11.5px] text-muted">
                                    {c}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-5 flex flex-wrap gap-2">
                                <Link href={askAbout(p.title)} className="btn-primary">
                                  Ask about this paper
                                </Link>
                                <a
                                  href={`https://arxiv.org/abs/${p.arxiv_id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-ghost"
                                >
                                  arXiv <ArrowUpRight className="h-3.5 w-3.5" />
                                </a>
                                {p.pdf_url && (
                                  <a href={p.pdf_url} target="_blank" rel="noreferrer" className="btn-ghost">
                                    PDF <ArrowUpRight className="h-3.5 w-3.5" />
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
                <button onClick={() => setShown((s) => s + PAGE)} className="btn-ghost">
                  Show more · {filtered.length - shown} remaining
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
