"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getEvals } from "@/lib/api";
import type { EvalReport } from "@/lib/types";
import { BackendNotice } from "@/components/backend-notice";
import { PageHeader } from "@/components/page-header";

const RATE_KEYS = ["faithfulness", "citation_coverage", "grounded_claim_rate"] as const;
const LABELS: Record<string, string> = {
  faithfulness: "Faithfulness",
  citation_coverage: "Citation coverage",
  grounded_claim_rate: "Grounded claims",
};

export default function EvalsPage() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getEvals().then(setReport).catch(() => setError(true));
  }, []);

  const agg = report?.aggregate ?? {};
  const hasRun = report && report.questions.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <PageHeader index="05" kicker="Open evaluation" title="Faithfulness, measured">
        The differentiator isn&apos;t fluent prose. It&apos;s being right. This dashboard runs a
        fixed benchmark through the full pipeline and scores how grounded the answers are. The
        same harness gates changes in CI.
      </PageHeader>

      {error && <BackendNotice />}

      {!error && (
        <>
          <div className="mb-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {RATE_KEYS.map((k) => (
              <MetricRing key={k} label={LABELS[k]} value={agg[k] ?? 0} hasRun={!!hasRun} />
            ))}
          </div>

          {!hasRun ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-[14px] text-mist">
              No eval run yet. Run{" "}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-signal">
                python -m veris.evals.harness
              </code>{" "}
              to populate this dashboard.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3 font-mono text-[11px] text-mist">
                <span>{report?.benchmark}</span>
                <span>{report?.model}</span>
              </div>
              <ul className="divide-y divide-white/[0.05]">
                {report?.questions.map((q, i) => (
                  <li key={i} className="px-5 py-4">
                    <p className="text-[14px] text-bone/90">{q.question}</p>
                    <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
                      {RATE_KEYS.map((k) => (
                        <Bar key={k} label={LABELS[k]} value={q.scores[k] ?? 0} />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricRing({ label, value, hasRun }: { label: string; value: number; hasRun: boolean }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? "#3ee6c4" : value >= 0.5 ? "#f5c46b" : "#f0707f";
  return (
    <div className="glass rounded-2xl p-5">
      <div className="kicker mb-3">{label}</div>
      <div className="flex items-end gap-2">
        <span className="font-display text-4xl" style={{ color: hasRun ? color : "#34343d" }}>
          {hasRun ? pct : "·"}
        </span>
        {hasRun && <span className="mb-1 font-mono text-xs text-mist">%</span>}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: hasRun ? `${pct}%` : 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="min-w-[120px] flex-1">
      <div className="mb-1 flex items-center justify-between font-mono text-[10.5px] text-mist">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-signal/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
