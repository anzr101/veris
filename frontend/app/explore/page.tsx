"use client";

import { useEffect, useState } from "react";
import { getPapers, getStats } from "@/lib/api";
import type { Paper, Stats } from "@/lib/types";
import { PaperCard } from "@/components/paper-card";
import { BackendNotice } from "@/components/backend-notice";
import { PageHeader } from "@/components/page-header";

export default function ExplorePage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <PageHeader index="04" kicker="The corpus" title="Explore the index">
        Papers ingested from arXiv (cs.LG / cs.CL / cs.AI), chunked and embedded for hybrid
        retrieval. The evidence Veris grounds its answers in.
      </PageHeader>

      {stats && (
        <div className="mb-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Papers" value={stats.papers.toLocaleString()} />
          <Stat label="Chunks" value={stats.chunks.toLocaleString()} />
          <Stat label="Embedder" value={stats.embedding_model.split("/").pop() ?? "n/a"} mono />
          <Stat label="Synthesis" value={stats.synthesis_model} mono />
        </div>
      )}

      {error && <BackendNotice />}
      {loading && !error && <p className="font-mono text-sm text-mist">Loading corpus…</p>}
      {!loading && !error && papers.length === 0 && (
        <p className="text-mist">
          No papers yet — the corpus loads at startup and can be extended via{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-signal">
            POST /v1/ingest
          </code>
          . Refresh shortly.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {papers.map((p, i) => (
          <PaperCard key={p.arxiv_id} paper={p} index={i} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="panel rounded-2xl p-5">
      <div className="kicker">{label}</div>
      <div
        className={`mt-2 text-bone-bright ${mono ? "font-mono text-[15px]" : "font-display text-2xl"}`}
      >
        {value}
      </div>
    </div>
  );
}
