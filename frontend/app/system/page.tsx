"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, RotateCw } from "lucide-react";
import { getStats } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { Corners, PageHead, Readout, SectionHead } from "@/components/ui";

const PROBES = [
  { name: "Health", method: "GET", path: "/health" },
  { name: "Corpus stats", method: "GET", path: "/v1/stats" },
  { name: "Papers", method: "GET", path: "/v1/papers?limit=1" },
  { name: "Atlas", method: "GET", path: "/v1/map" },
];

interface Sample {
  ok: boolean;
  ms: number;
}

const HISTORY = 24;
const INTERVAL = 15_000;

export default function SystemPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [samples, setSamples] = useState<Record<string, Sample[]>>({});
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const busy = useRef(false);

  const probe = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    const results = await Promise.all(
      PROBES.map(async (p) => {
        const t0 = performance.now();
        try {
          const res = await fetch(`/api${p.path}`, { cache: "no-store" });
          await res.arrayBuffer();
          return [p.path, { ok: res.ok, ms: performance.now() - t0 }] as const;
        } catch {
          return [p.path, { ok: false, ms: performance.now() - t0 }] as const;
        }
      }),
    );
    setSamples((prev) => {
      const next = { ...prev };
      for (const [path, s] of results) next[path] = [...(prev[path] ?? []), s].slice(-HISTORY);
      return next;
    });
    setCheckedAt(new Date());
    setChecking(false);
    busy.current = false;
  }, []);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    probe();
    const t = setInterval(probe, INTERVAL);
    return () => clearInterval(t);
  }, [probe]);

  const latest = PROBES.map((p) => samples[p.path]?.at(-1));
  const allOk = latest.every((s) => s?.ok);
  const anyData = latest.some(Boolean);
  const all = Object.values(samples).flat().filter((s) => s.ok).map((s) => s.ms).sort((a, b) => a - b);
  const p50 = all.length ? all[Math.floor(all.length / 2)] : null;
  const uptime = (() => {
    const flat = Object.values(samples).flat();
    return flat.length ? (flat.filter((s) => s.ok).length / flat.length) * 100 : null;
  })();

  return (
    <div className="flex-1">
      <div className="grid-paper border-b border-line">
        <div className="mx-auto max-w-page px-5 pb-14 pt-14 sm:px-8">
          <PageHead
            index="07"
            title="System"
            meta={
              <button onClick={probe} className="btn-ghost" disabled={checking}>
                <RotateCw className={clsx("h-3.5 w-3.5", checking && "animate-spin")} />
                {checkedAt ? `Checked ${checkedAt.toLocaleTimeString()}` : "Checking"}
              </button>
            }
          />

          <div
            className={clsx(
              "relative mt-10 flex items-center gap-4 border px-6 py-5",
              !anyData ? "border-line bg-surface" : allOk ? "border-ok/30 bg-ok/[0.06]" : "border-warn/40 bg-warn/[0.06]",
            )}
          >
            <span className="relative flex h-2.5 w-2.5">
              {anyData && allOk && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/60" />}
              <span
                className={clsx(
                  "relative inline-flex h-2.5 w-2.5 rounded-full",
                  !anyData ? "bg-faint" : allOk ? "bg-ok" : "bg-warn",
                )}
              />
            </span>
            <span className="text-[17px]">
              {!anyData ? "Running checks" : allOk ? "All systems operational" : "Partial degradation"}
            </span>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-y-10 lg:grid-cols-4">
            <Readout value={p50 !== null ? Math.round(p50) : "—"} unit="ms" caption="Median latency" />
            <div className="lg:border-l lg:border-line lg:pl-10">
              <Readout value={uptime !== null ? uptime.toFixed(0) : "—"} unit="%" caption="Checks passing" />
            </div>
            <div className="lg:border-l lg:border-line lg:pl-10">
              <Readout value={stats?.papers ?? "—"} caption="Papers" />
            </div>
            <div className="lg:border-l lg:border-line lg:pl-10">
              <Readout value={stats?.chunks.toLocaleString() ?? "—"} caption="Passages" />
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-page px-5 py-16 sm:px-8">
        <SectionHead index="7.1" title="Endpoints" />
        <div className="mt-10 border-t border-ink">
          {PROBES.map((p) => {
            const hist = samples[p.path] ?? [];
            const last = hist.at(-1);
            const max = Math.max(...hist.map((s) => s.ms), 1);
            return (
              <div
                key={p.path}
                className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 border-b border-line py-5 md:grid-cols-[220px_1fr_200px_90px]"
              >
                <div>
                  <div className="text-[15px]">{p.name}</div>
                  <div className="mt-0.5 text-[12px] text-faint">
                    <span className="text-blue">{p.method}</span> {p.path}
                  </div>
                </div>
                <div className="hidden h-8 items-end gap-[3px] md:flex">
                  {Array.from({ length: HISTORY }).map((_, i) => {
                    const s = hist[i - (HISTORY - hist.length)];
                    return (
                      <span
                        key={i}
                        className={clsx("flex-1 transition-all", !s ? "bg-line" : s.ok ? "bg-blue/70" : "bg-bad")}
                        style={{ height: s ? `${Math.max(12, (s.ms / max) * 100)}%` : "12%" }}
                        title={s ? `${Math.round(s.ms)} ms` : undefined}
                      />
                    );
                  })}
                </div>
                <div className="hidden text-right text-[13px] text-muted md:block">
                  {last ? `${Math.round(last.ms)} ms` : "—"}
                </div>
                <div className="flex justify-end">
                  <span
                    className={clsx(
                      "border px-2 py-0.5 text-[11.5px] font-medium uppercase tracking-label",
                      !last ? "border-line text-faint" : last.ok ? "border-ok/30 text-ok" : "border-bad/30 text-bad",
                    )}
                  >
                    {!last ? "…" : last.ok ? "OK" : "Fail"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-page gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2">
          <div>
            <SectionHead index="7.2" title="Configuration" />
            <dl className="mt-10 border-t border-ink text-[14px]">
              {[
                ["Synthesis model", stats?.synthesis_model],
                ["Utility model", stats?.utility_model],
                ["Embedding model", stats?.embedding_model],
                ["Retrieval", "Dense 40 + BM25 40 → RRF (k = 60) → 12"],
                ["Rate limit · ask", "10 / minute / client"],
                ["Rate limit · default", "120 / minute / client"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 border-b border-line py-3.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right text-ink">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:pt-[92px]">
            <div className="grid-navy relative bg-navy p-8 text-white">
              <Corners dark />
              <div className="label-dark">API reference</div>
              <p className="mt-4 text-[22px] font-light leading-snug tracking-[-0.01em]">
                OpenAPI schema with interactive requests for every endpoint.
              </p>
              <a href="/api/docs" target="_blank" rel="noreferrer" className="btn-primary mt-8">
                Open API docs <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
