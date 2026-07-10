"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RotateCcw } from "lucide-react";
import { getEvals, postEvalsRun } from "@/lib/api";
import type { EvalReport } from "@/lib/types";
import { BackendNotice } from "@/components/backend-notice";
import { PageHeader } from "@/components/page-header";

const RATE_KEYS = ["faithfulness", "citation_coverage", "grounded_claim_rate"] as const;
const LABELS: Record<string, string> = {
  faithfulness: "Faithfulness",
  citation_coverage: "Citation coverage",
  grounded_claim_rate: "Grounded claims",
};

const POLL_MS = 15_000;

export default function EvalsPage() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [error, setError] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasRun = !!report && report.questions.length > 0;

  // The backend self-runs the benchmark on first request after boot; keep polling
  // until the report lands, then stop.
  const refresh = useCallback(() => {
    getEvals()
      .then((r) => {
        setReport(r);
        setError(false);
        if (r.questions.length > 0 && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  const rerun = async () => {
    setRerunning(true);
    try {
      await postEvalsRun();
      if (!timer.current) timer.current = setInterval(refresh, POLL_MS);
    } finally {
      setTimeout(() => setRerunning(false), 3000);
    }
  };

  const agg = report?.aggregate ?? {};

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
              <MetricRing key={k} label={LABELS[k]} value={agg[k] ?? 0} hasRun={hasRun} />
            ))}
          </div>

          {!hasRun ? (
            <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-[14px] text-mist">
              <Loader2 className="mt-0.5 h-4 w-4 flex-none animate-spin text-signal/70" />
              <div>
                <p className="text-bone/90">
                  {report?.note ??
                    "The benchmark runs automatically against the live pipeline — results appear here in a few minutes."}
                </p>
                <p className="mt-1 text-[12.5px]">
                  5 research questions × plan → retrieve → synthesize → verify, scored for
                  grounding. This page refreshes itself.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3 font-mono text-[11px] text-mist">
                <span>{report?.benchmark}</span>
                <span className="flex items-center gap-4">
                  {report?.model}
                  <button
                    onClick={rerun}
                    disabled={rerunning}
                    className="inline-flex items-center gap-1 text-signal hover:underline disabled:opacity-50"
                    title="Re-run the benchmark against the live pipeline"
                  >
                    <RotateCcw className="h-3 w-3" /> {rerunning ? "starting…" : "re-run"}
                  </button>
                </span>
              </div>
              {report?.note && (
                <p className="border-b border-white/[0.06] px-5 py-2.5 text-[12px] text-amber/80">
                  {report.note}
                </p>
              )}
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
