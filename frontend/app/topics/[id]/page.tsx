"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { getAllPapers, getMap } from "@/lib/api";
import type { MapArtifact, Paper } from "@/lib/types";
import { byNewest, formatDate, topicsFrom } from "@/lib/corpus";
import { topicColor } from "@/lib/palette";
import { Corners, Readout } from "@/components/ui";
import { TopicThumb } from "@/components/overview/topic-thumb";

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const topicId = Number(id);
  const [map, setMap] = useState<MapArtifact | null>(null);
  const [papers, setPapers] = useState<Paper[] | null>(null);

  useEffect(() => {
    getMap().then(setMap).catch(() => {});
    getAllPapers().then(setPapers).catch(() => {});
  }, []);

  const topics = useMemo(() => (map ? topicsFrom(map) : []), [map]);
  const rank = topics.findIndex((t) => t.id === topicId);
  const topic = topics[rank];
  const prev = rank > 0 ? topics[rank - 1] : undefined;
  const next = rank >= 0 && rank < topics.length - 1 ? topics[rank + 1] : undefined;

  const members = useMemo(() => {
    if (!topic || !papers) return [];
    const ids = new Set(topic.paperIds);
    return byNewest(papers.filter((p) => ids.has(p.arxiv_id)));
  }, [topic, papers]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of members) for (const c of p.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [members]);

  const bounds = useMemo(() => {
    if (!map) return { x0: 0, x1: 1, y0: 0, y1: 1 };
    const xs = map.nodes.map((n) => n.x);
    const ys = map.nodes.map((n) => n.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }, [map]);

  if (map && !topic) {
    return (
      <div className="mx-auto w-full max-w-page px-5 py-24 sm:px-8">
        <p className="text-[22px] font-light">Topic not found.</p>
        <Link href="/topics" className="btn-ghost mt-6">
          All topics
        </Link>
      </div>
    );
  }

  const color = topicColor(topicId);
  const authors = new Set(members.flatMap((p) => p.authors)).size;

  return (
    <div className="flex-1">
      <section className="grid-paper border-b border-line">
        <div className="mx-auto grid max-w-page gap-10 px-5 pb-14 pt-10 sm:px-8 lg:grid-cols-[1fr_380px]">
          <div>
            <Link href="/topics" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-blue">
              <ArrowLeft className="h-3.5 w-3.5" /> Topics
            </Link>
            <div className="mt-8 flex items-center gap-3 text-[12px] text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              T{String(rank + 1).padStart(2, "0")}
            </div>
            {topic ? (
              <>
                <h1 className="mt-3 text-[38px] font-light leading-[1.08] tracking-[-0.03em] sm:text-[52px]">
                  {topic.label}
                </h1>
                <p className="mt-5 max-w-[640px] text-[16px] leading-relaxed text-ink-soft">{topic.description}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={`/ask?q=${encodeURIComponent(`Summarize the main approaches and open problems in ${topic.label}.`)}`}
                    className="btn-primary"
                  >
                    Ask about this topic <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link href={`/atlas?topic=${topic.id}`} className="btn-ghost">
                    View in atlas
                  </Link>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="skeleton h-12 w-3/4 rounded" />
                <div className="skeleton h-4 w-2/3 rounded" />
              </div>
            )}
          </div>
          <div className="panel self-start p-3">
            <Corners />
            <div className="label mb-2 px-1">Footprint</div>
            <div className="aspect-[5/3]">
              {map && <TopicThumb nodes={map.nodes} bounds={bounds} cluster={topicId} color={color} />}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-page px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-y-10 border-b border-line pb-12 lg:grid-cols-4">
          <Readout value={topic?.size ?? "—"} caption="Papers" />
          <div className="lg:border-l lg:border-line lg:pl-10">
            <Readout
              value={topic && map ? ((topic.size / map.n_papers) * 100).toFixed(1) : "—"}
              unit="%"
              caption="Of corpus"
            />
          </div>
          <div className="lg:border-l lg:border-line lg:pl-10">
            <Readout value={papers ? authors : "—"} caption="Authors" />
          </div>
          <div className="lg:border-l lg:border-line lg:pl-10">
            <div className="label">Categories</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {categories.map(([c, n]) => (
                <span key={c} className="border border-line bg-surface px-2 py-0.5 text-[12px] text-ink-soft">
                  {c} <span className="text-faint">{n}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="label mt-12">Papers</div>
        <ul className="mt-3 border-t border-ink">
          {!papers &&
            Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="border-b border-line py-5">
                <div className="skeleton h-4 rounded" style={{ width: `${85 - i * 6}%` }} />
              </li>
            ))}
          {members.map((p, i) => (
            <motion.li
              key={p.arxiv_id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              className="border-b border-line"
            >
              <a
                href={`https://arxiv.org/abs/${p.arxiv_id}`}
                target="_blank"
                rel="noreferrer"
                className="group grid grid-cols-[1fr_auto] items-baseline gap-x-8 gap-y-1 py-5 sm:grid-cols-[120px_1fr_110px_20px]"
              >
                <span className="hidden text-[12.5px] text-muted sm:block">{p.arxiv_id}</span>
                <span>
                  <span className="block text-[16px] leading-snug text-ink transition-colors group-hover:text-blue">
                    {p.title}
                  </span>
                  <span className="mt-1 block truncate text-[12.5px] text-faint">{p.authors.slice(0, 3).join(", ")}</span>
                </span>
                <span className="text-right text-[12.5px] text-faint">{formatDate(p.published_at)}</span>
                <ArrowUpRight className="hidden h-4 w-4 text-faint group-hover:text-blue sm:block" />
              </a>
            </motion.li>
          ))}
        </ul>

        <div className="mt-12 flex justify-between gap-4">
          {prev ? (
            <Link href={`/topics/${prev.id}`} className="group max-w-[45%] text-left">
              <div className="label">Previous</div>
              <div className="mt-1.5 text-[15px] text-ink-soft group-hover:text-blue">{prev.label}</div>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/topics/${next.id}`} className="group max-w-[45%] text-right">
              <div className="label">Next</div>
              <div className="mt-1.5 text-[15px] text-ink-soft group-hover:text-blue">{next.label}</div>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
