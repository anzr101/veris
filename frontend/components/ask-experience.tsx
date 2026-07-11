"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Map as MapIcon, RotateCcw, TriangleAlert } from "lucide-react";
import { askStream, getStats } from "@/lib/api";
import type {
  AskState,
  Citation,
  ClaimVerification,
  Contradiction,
  QueryPlan,
  Stats,
} from "@/lib/types";
import { easeOutExpo } from "@/lib/motion";
import { AskConsole } from "./ask-console";
import { Constellation } from "./constellation";
import { CountUp } from "./count-up";
import { Pipeline } from "./pipeline";
import { AnswerView } from "./answer-view";
import { Sources } from "./sources";
import { FaithfulnessMeter } from "./faithfulness-meter";
import { Verification, Contradictions } from "./verification";

const INITIAL: AskState = { stage: "idle", citations: [], answer: "", claims: [], contradictions: [] };

// The headline reveals word by word; "verify" gets the gradient treatment.
const HEADLINE_L1 = ["Research", "answers"];
const HEADLINE_L2 = ["you", "can"];

export function AskExperience() {
  const [state, setState] = useState<AskState>(INITIAL);
  const [question, setQuestion] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  const run = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setQuestion(q);
    setState({ ...INITIAL, stage: "planning" });

    try {
      await askStream(
        q,
        (ev) => {
          setState((prev) => reduce(prev, ev.event, ev.data));
        },
        controller.signal,
      );
    } catch (err) {
      setState((prev) => ({
        ...prev,
        stage: "done",
        error:
          "Couldn't reach the Veris backend — it may be waking from a cold start. Try again in ~30 seconds.",
      }));
    }
  }, []);

  const reset = () => {
    abortRef.current?.abort();
    setQuestion("");
    setState(INITIAL);
  };

  const active = state.stage !== "idle";

  return (
    <div className="relative mx-auto max-w-6xl px-5">
      <AnimatePresence mode="wait">
        {!active ? (
          <motion.section
            key="hero"
            exit={{ opacity: 0, y: -12 }}
            className="relative flex min-h-[86vh] flex-col justify-center py-20"
          >
            {/* Star-map backdrop, faded out toward the edges. */}
            <div className="absolute inset-0 [mask-image:radial-gradient(85%_75%_at_50%_38%,black,transparent)]">
              <Constellation className="opacity-70" />
            </div>

            <div className="relative mx-auto w-full max-w-3xl">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: easeOutExpo }}
                className="mb-9 flex items-center gap-4"
              >
                <span className="index-num">01</span>
                <span className="h-px w-12 bg-white/15" />
                <span className="kicker">Ask · grounded synthesis</span>
              </motion.div>

              <h1
                className="font-display font-normal tracking-tight text-bone-bright"
                style={{ fontSize: "clamp(2.6rem, 5.2vw, 4.4rem)", lineHeight: 1.04 }}
              >
                {HEADLINE_L1.map((w, i) => (
                  <Word key={w} delay={0.08 + i * 0.07}>{w}</Word>
                ))}
                <br className="hidden sm:block" />
                {HEADLINE_L2.map((w, i) => (
                  <Word key={w} delay={0.22 + i * 0.07}>{w}</Word>
                ))}
                <Word delay={0.42}>
                  <span className="bg-gradient-to-r from-signal via-[#F0DCAA] to-signal bg-clip-text italic text-transparent">
                    verify
                  </span>
                  .
                </Word>
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6, ease: easeOutExpo }}
                className="mt-6 max-w-xl text-[17px] leading-relaxed text-mist"
              >
                Every claim traceable to a span in a real paper, independently checked for
                entailment, with cross-paper contradiction detection.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6, ease: easeOutExpo }}
                className="mt-10"
              >
                <AskConsole onSubmit={run} />
              </motion.div>

              {/* Live corpus pulse — proof the atlas is real, counted up on arrival. */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: stats ? 1 : 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-2 font-mono text-[12px] text-mist"
              >
                {stats && (
                  <>
                    <span className="flex items-center gap-2">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal/60 motion-reduce:animate-none" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
                      </span>
                      <CountUp value={stats.papers} className="text-bone-bright" /> papers indexed
                    </span>
                    <span>
                      <CountUp value={stats.chunks} className="text-bone-bright" /> evidence passages
                    </span>
                    <Link href="/map" className="group inline-flex items-center gap-1.5 text-signal/90 transition-colors hover:text-signal">
                      <MapIcon className="h-3 w-3" /> explore the map
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </Link>
                  </>
                )}
              </motion.div>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-10"
          >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="kicker mb-1.5">Question</div>
                <h2 className="font-display text-2xl leading-snug text-bone">{question}</h2>
              </div>
              <motion.button
                onClick={reset}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="chip flex-none"
                title="Ask another question"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New question
              </motion.button>
            </div>

            <div className="mb-8">
              <Pipeline stage={state.stage} />
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
              {/* Answer column */}
              <div className="min-w-0">
                {state.error && !state.answer ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose/30 bg-rose/[0.05] p-5">
                    <TriangleAlert className="mt-0.5 h-5 w-5 flex-none text-rose" />
                    <p className="text-[14px] leading-relaxed text-bone/90">{state.error}</p>
                  </div>
                ) : state.answer ? (
                  <>
                    <AnswerView
                      markdown={state.answer}
                      citations={state.citations}
                      streaming={state.stage === "synthesizing"}
                    />
                    {/* A late-stage provider hiccup (e.g. verification) must not bury
                        the answer the user already has. */}
                    {state.error && (
                      <p className="mt-5 flex items-start gap-2 rounded-xl border border-amber/25 bg-amber/[0.05] p-3 text-[12.5px] leading-snug text-mist">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-amber" />
                        Verification was cut short by the free-tier provider quota — the
                        answer and citations above are unaffected.
                      </p>
                    )}
                  </>
                ) : (
                  <SkeletonAnswer />
                )}

                {state.stage === "done" && !state.error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.06] pt-4 font-mono text-[11px] text-mist"
                  >
                    {state.model && <span>model · {state.model}</span>}
                    {typeof state.cost_usd === "number" && (
                      <span>cost · ${state.cost_usd.toFixed(4)}</span>
                    )}
                    {typeof state.latency_ms === "number" && (
                      <span>latency · {(state.latency_ms / 1000).toFixed(1)}s</span>
                    )}
                    {state.citations.length > 0 && (
                      <Link
                        href={`/map?ids=${state.citations.map((c) => c.arxiv_id).join(",")}`}
                        className="inline-flex items-center gap-1 text-signal hover:underline"
                      >
                        <MapIcon className="h-3 w-3" /> show sources on map
                      </Link>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Insights rail */}
              <aside className="space-y-7">
                {typeof state.faithfulness === "number" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: easeOutExpo }}
                    className="glass rounded-2xl p-4"
                  >
                    <FaithfulnessMeter value={state.faithfulness} />
                  </motion.div>
                )}
                <Sources citations={state.citations} />
                <Verification claims={state.claims} />
                <Contradictions items={state.contradictions} />
              </aside>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function Word({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 22, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.65, delay, ease: easeOutExpo }}
      className="mr-[0.26em] inline-block"
    >
      {children}
    </motion.span>
  );
}

function reduce(prev: AskState, event: string, data: unknown): AskState {
  switch (event) {
    case "plan":
      return { ...prev, plan: data as QueryPlan, stage: "retrieving" };
    case "citations":
      return { ...prev, citations: data as Citation[], stage: "synthesizing" };
    case "token":
      return { ...prev, answer: prev.answer + String(data) };
    case "verification": {
      const d = data as { claims: ClaimVerification[]; faithfulness: number };
      return { ...prev, claims: d.claims, faithfulness: d.faithfulness, stage: "verifying" };
    }
    case "contradictions":
      return { ...prev, contradictions: data as Contradiction[] };
    case "error": {
      const d = data as { detail?: string };
      return { ...prev, stage: "done", error: d?.detail ?? "The LLM provider is unavailable right now." };
    }
    case "done": {
      const d = data as { model: string; cost_usd: number; latency_ms: number };
      return { ...prev, stage: "done", model: d.model, cost_usd: d.cost_usd, latency_ms: d.latency_ms };
    }
    default:
      return prev;
  }
}

function SkeletonAnswer() {
  return (
    <div className="space-y-3.5">
      {[100, 96, 88, 92, 70].map((w, i) => (
        <div
          key={i}
          className="shimmer h-4 rounded-md"
          style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}
