"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { getMap } from "@/lib/api";
import type { MapArtifact } from "@/lib/types";
import { topicsFrom } from "@/lib/corpus";
import { topicColor } from "@/lib/palette";
import { PageHead } from "@/components/ui";
import { TopicThumb } from "@/components/overview/topic-thumb";

export default function TopicsPage() {
  const [map, setMap] = useState<MapArtifact | null>(null);

  useEffect(() => {
    getMap().then(setMap).catch(() => {});
  }, []);

  const topics = useMemo(() => (map ? topicsFrom(map) : []), [map]);
  const total = map?.n_papers ?? 0;
  const bounds = useMemo(() => {
    if (!map) return { x0: 0, x1: 1, y0: 0, y1: 1 };
    const xs = map.nodes.map((n) => n.x);
    const ys = map.nodes.map((n) => n.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }, [map]);

  return (
    <div className="grid-paper flex-1">
      <div className="mx-auto w-full max-w-page px-5 pb-24 pt-14 sm:px-8">
        <PageHead index="04" title="Topics" meta={map ? `${topics.length} clusters · ${total} papers` : undefined} />

        {/* Share of corpus by topic */}
        {map && (
          <div className="mt-10">
            <div className="label">Share of corpus</div>
            <div className="mt-3 flex h-3 w-full overflow-hidden">
              {topics.map((t, i) => (
                <motion.div
                  key={t.id}
                  title={`${t.label} · ${t.size}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.5 }}
                  className="h-full origin-left border-r-2 border-paper"
                  style={{ width: `${(t.size / total) * 100}%`, background: topicColor(t.id) }}
                />
              ))}
            </div>
          </div>
        )}

        <ol className="mt-12 grid gap-5 md:grid-cols-2">
          {!map &&
            Array.from({ length: 6 }).map((_, i) => <li key={i} className="skeleton h-[220px]" />)}
          {map &&
            topics.map((t, i) => (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.45 }}
              >
                <Link
                  href={`/topics/${t.id}`}
                  className="panel group grid h-full grid-cols-[1fr_150px] gap-6 p-6 transition-colors hover:border-blue/40"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2.5 text-[12px] text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: topicColor(t.id) }} />
                      T{String(i + 1).padStart(2, "0")}
                      <span className="text-faint">·</span>
                      {((t.size / total) * 100).toFixed(1)}%
                    </div>
                    <h2 className="mt-3 text-[20px] font-medium leading-snug tracking-[-0.01em] transition-colors group-hover:text-blue">
                      {t.label}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-muted">{t.description}</p>
                    <div className="mt-auto flex items-center justify-between pt-5 text-[13px]">
                      <span>
                        <span className="text-[22px] font-light">{t.size}</span>
                        <span className="ml-1.5 text-muted">papers</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-faint transition-colors group-hover:text-blue" />
                    </div>
                  </div>
                  <div className="self-center border border-line bg-paper/60 p-1">
                    <TopicThumb nodes={map.nodes} bounds={bounds} cluster={t.id} color={topicColor(t.id)} />
                  </div>
                </Link>
              </motion.li>
            ))}
        </ol>
      </div>
    </div>
  );
}
