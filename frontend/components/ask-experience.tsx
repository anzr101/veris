"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, Map as MapIcon, RotateCcw, TriangleAlert } from "lucide-react";
import { askStream } from "@/lib/api";
import type {
  AskState,
  Citation,
  ClaimVerification,
  Contradiction,
  QueryPlan,
} from "@/lib/types";
import { AskConsole } from "./ask-console";
import { Pipeline } from "./pipeline";
import { AnswerView } from "./answer-view";
import { Sources } from "./sources";
import { FaithfulnessMeter } from "./faithfulness-meter";
import { Verification, Contradictions } from "./verification";

const INITIAL: AskState = { stage: "idle", citations: [], answer: "", claims: [], contradictions: [] };

export function AskExperience() {
  const [state, setState] = useState<AskState>(INITIAL);
  const [question, setQuestion] = useState("");
  const abortRef = useRef<AbortController | null>(null);

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
          "Couldn't reach the Veris backend. Start it with `make up` (or `uvicorn veris.main:app`) and ensure a corpus is ingested.",
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
            className="relative flex min-h-[82vh] flex-col justify-center py-20"
          >
            <div className="mx-auto w-full max-w-3xl">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="mb-9 flex items-center gap-4">
                  <span className="index-num">01</span>
                  <span className="h-px w-12 bg-white/15" />
                  <span className="kicker">Ask · grounded synthesis</span>
                </div>
                <h1
                  className="font-display font-normal tracking-tight text-bone-bright"
                  style={{ fontSize: "clamp(2.6rem, 5.2vw, 4.4rem)", lineHeight: 1.0 }}
                >
                  Research answers
                  <br className="hidden sm:block" /> you can{" "}
                  <span className="italic text-signal">verify</span>.
                </h1>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-mist">
                  Every claim traceable to a span in a real paper, independently checked for
                  entailment, with cross-paper contradiction detection.
                </p>
              </motion.div>

              <div className="mt-10">
                <AskConsole onSubmit={run} />
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-9 flex flex-wrap items-center gap-3"
              >
                <Link href="/map" className="chip">
                  <MapIcon className="h-3.5 w-3.5 text-signal" /> Explore the map of science
                </Link>
                <Link href="/position" className="chip">
                  <Compass className="h-3.5 w-3.5 text-signal" /> Position your research
                </Link>
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
              <button
                onClick={reset}
                className="chip flex-none"
                title="Ask another question"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New question
              </button>
            </div>

            <div className="mb-8">
              <Pipeline stage={state.stage} />
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
              {/* Answer column */}
              <div className="min-w-0">
                {state.error ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose/30 bg-rose/[0.05] p-5">
                    <TriangleAlert className="mt-0.5 h-5 w-5 flex-none text-rose" />
                    <p className="text-[14px] leading-relaxed text-bone/90">{state.error}</p>
                  </div>
                ) : state.answer ? (
                  <AnswerView
                    markdown={state.answer}
                    citations={state.citations}
                    streaming={state.stage === "synthesizing"}
                  />
                ) : (
                  <SkeletonAnswer />
                )}

                {state.stage === "done" && !state.error && (
                  <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.06] pt-4 font-mono text-[11px] text-mist">
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
                  </div>
                )}
              </div>

              {/* Insights rail */}
              <aside className="space-y-7">
                {typeof state.faithfulness === "number" && (
                  <div className="glass rounded-2xl p-4">
                    <FaithfulnessMeter value={state.faithfulness} />
                  </div>
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
    <div className="space-y-3">
      {[100, 96, 88, 92, 70].map((w, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-gradient-to-r from-white/[0.03] via-white/[0.07] to-white/[0.03] bg-[length:200%_100%]"
          style={{ width: `${w}%`, animationDelay: `${i * 0.08}s` }}
        />
      ))}
    </div>
  );
}
