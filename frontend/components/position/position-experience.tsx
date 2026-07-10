"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb, Map as MapIcon, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { postPosition } from "@/lib/api";
import type { PositionReport } from "@/lib/types";
import { easeOutExpo } from "@/lib/motion";
import { AnswerView } from "@/components/answer-view";
import { Sources } from "@/components/sources";
import { NoveltyGauge } from "./novelty-gauge";
import { NearestWork } from "./nearest";
import { Collaborators } from "./collaborators";

const EXAMPLE =
  "We propose a graph-based memory for long-horizon language agents that stores intermediate reasoning as a retrievable knowledge graph, letting the agent recall and revise prior conclusions across thousands of steps without re-deriving them.";

type Phase = "idle" | "loading" | "done" | "error";

export function PositionExperience() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<PositionReport | null>(null);

  const run = async (input: string) => {
    setText(input);
    setPhase("loading");
    setReport(null);
    try {
      setReport(await postPosition(input));
      setPhase("done");
    } catch {
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("idle");
    setReport(null);
    setText("");
  };

  if (phase === "idle") {
    return (
      <div className="relative mx-auto flex min-h-[82vh] max-w-3xl flex-col justify-center px-6 py-20">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: easeOutExpo }}>
          <div className="mb-8 flex items-center gap-4">
            <span className="index-num">02</span>
            <span className="h-px w-12 bg-white/15" />
            <span className="kicker">Position · your work</span>
          </div>
          <h1
            className="font-display font-normal tracking-tight text-bone-bright"
            style={{ fontSize: "clamp(2.4rem, 5vw, 4.2rem)", lineHeight: 1.02 }}
          >
            Where does your idea
            <br className="hidden sm:block" /> sit in the{" "}
            <span className="italic text-signal">literature</span>?
          </h1>
          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-mist">
            Paste an abstract or idea. Get a novelty read, the nearest prior work, adjacent
            researchers, open gaps, and a grounded related-work draft.
          </p>
        </motion.div>

        <div className="mt-10 w-full max-w-2xl">
          <div className="group rounded-2xl border border-white/10 bg-ink-50/60 p-2 shadow-lift backdrop-blur-xl transition-colors focus-within:border-signal/40 focus-within:shadow-glow">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Paste your abstract or research idea (at least a sentence or two)…"
              className="w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-bone placeholder:text-mist/60 focus:outline-none"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-mist">
                <Sparkles className="h-3.5 w-3.5 text-signal/70" /> grounded · public data only
              </span>
              <button
                onClick={() => text.trim().length >= 20 && run(text.trim())}
                disabled={text.trim().length < 20}
                className="rounded-xl bg-signal px-4 py-2 text-sm font-medium text-ink transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-mist"
              >
                Position it
              </button>
            </div>
          </div>
          <button onClick={() => run(EXAMPLE)} className="chip mt-4">
            Try an example idea
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="kicker mb-1.5">Your idea</div>
          <p className="font-display text-lg leading-snug text-bone">{text}</p>
        </div>
        <button onClick={reset} className="chip flex-none">
          <RotateCcw className="h-3.5 w-3.5" /> New idea
        </button>
      </div>

      {phase === "error" && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose/30 bg-rose/[0.05] p-5">
          <TriangleAlert className="mt-0.5 h-5 w-5 flex-none text-rose" />
          <p className="text-[14px] leading-relaxed text-bone/90">
            Couldn&apos;t reach the backend — it may be waking from a cold start. Try again in
            ~30 seconds.
          </p>
        </div>
      )}

      {phase === "loading" && (
        <div className="space-y-3">
          {[100, 70, 90, 60].map((w, i) => (
            <div
              key={i}
              className="h-5 animate-pulse rounded bg-gradient-to-r from-white/[0.03] via-white/[0.07] to-white/[0.03]"
              style={{ width: `${w}%`, animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {phase === "done" && report && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
              <NoveltyGauge
                novelty={report.novelty_score}
                density={report.density}
                crowded={report.crowded_count}
              />
              {report.nearest.length > 0 && (
                <Link
                  href={`/map?ids=${report.nearest.map((p) => p.arxiv_id).join(",")}`}
                  className="glass flex items-center justify-center gap-2 rounded-2xl px-6 text-sm text-bone transition-colors hover:border-signal/40"
                >
                  <MapIcon className="h-4 w-4 text-signal" /> Show on the map
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
              <div className="min-w-0">
                <div className="kicker mb-3">Grounded related work</div>
                {report.related_work_markdown ? (
                  <AnswerView markdown={report.related_work_markdown} citations={report.citations} />
                ) : (
                  <p className="text-mist">No related work could be grounded for this idea.</p>
                )}

                {report.gaps.length > 0 && (
                  <div className="mt-8">
                    <div className="kicker mb-3 flex items-center gap-1.5">
                      <Lightbulb className="h-3 w-3 text-amber" /> Open gaps
                    </div>
                    <ul className="space-y-2">
                      {report.gaps.map((g, i) => (
                        <li
                          key={i}
                          className="rounded-xl border border-amber/20 bg-amber/[0.04] p-3 text-[14px] leading-snug text-bone/90"
                        >
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.06] pt-4 font-mono text-[11px] text-mist">
                  {report.model && <span>model · {report.model}</span>}
                  <span>cost · ${report.cost_usd.toFixed(4)}</span>
                  <span>latency · {(report.latency_ms / 1000).toFixed(1)}s</span>
                </div>
              </div>

              <aside className="space-y-7">
                <NearestWork papers={report.nearest} />
                <Collaborators items={report.collaborators} />
                <Sources citations={report.citations} />
              </aside>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
