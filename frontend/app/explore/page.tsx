"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { getPapers, getStats } from "@/lib/api";
import type { Paper, Stats } from "@/lib/types";
import { easeOutExpo } from "@/lib/motion";
import { CountUp } from "@/components/count-up";
import { PaperCard } from "@/components/paper-card";
import { BackendNotice } from "@/components/backend-notice";
import { PageHeader } from "@/components/page-header";

export default function ExplorePage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getPapers(48)])
      .then(([s, p]) => {
        setStats(s);
        setPapers(p);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return papers;
    return papers.filter(
      (p) => p.title.toLowerCase().includes(q) || p.abstract.toLowerCase().includes(q),
    );
  }, [papers, query]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <PageHeader index="03" kicker="The corpus" title="Explore the index">
        Papers ingested from arXiv (cs.LG / cs.CL / cs.AI), chunked and embedded for hybrid
        retrieval. The evidence Veris grounds its answers in.
      </PageHeader>

      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOutExpo }}
          className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          <Stat label="Papers">
            <CountUp value={stats.papers} className="font-display text-2xl" />
          </Stat>
          <Stat label="Chunks">
            <CountUp value={stats.chunks} className="font-display text-2xl" />
          </Stat>
          <Stat label="Embedder">
            <span className="font-mono text-[15px]">
              {stats.embedding_model.split("/").pop() ?? "n/a"}
            </span>
          </Stat>
          <Stat label="Synthesis">
            <span className="font-mono text-[15px]">{stats.synthesis_model}</span>
          </Stat>
        </motion.div>
      )}

      {!error && papers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45, ease: easeOutExpo }}
          className="mb-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-50/60 px-4
                     py-3 backdrop-blur-xl transition-colors focus-within:border-signal/40"
        >
          <Search className="h-4 w-4 flex-none text-mist" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter papers by title or abstract…"
            className="w-full bg-transparent text-[14.5px] text-bone placeholder:text-mist/60 focus:outline-none"
          />
          {query && (
            <span className="flex-none font-mono text-[11px] text-mist">
              {filtered.length} match{filtered.length === 1 ? "" : "es"}
            </span>
          )}
        </motion.div>
      )}

      {error && <BackendNotice />}
      {loading && !error && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer h-48 rounded-2xl" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      )}
      {!loading && !error && papers.length === 0 && (
        <p className="text-mist">
          No papers yet — the corpus loads at startup and can be extended via{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-signal">
            POST /v1/ingest
          </code>
          . Refresh shortly.
        </p>
      )}
      {!loading && !error && papers.length > 0 && filtered.length === 0 && (
        <p className="text-mist">Nothing matches “{query}” — try a broader term.</p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p, i) => (
          <PaperCard key={p.arxiv_id} paper={p} index={i} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel rounded-2xl p-5 transition-colors duration-300 hover:border-signal/20">
      <div className="kicker">{label}</div>
      <div className="mt-2 text-bone-bright">{children}</div>
    </div>
  );
}
