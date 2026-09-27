"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Plus, RotateCw } from "lucide-react";
import { AskError, askStream } from "@/lib/api";
import type { AskState, Citation, ClaimVerification, Contradiction, QueryPlan } from "@/lib/types";
import { ease } from "@/lib/motion";
import { type Run, clearRuns, loadRuns, saveRun } from "@/lib/runs";
import { Corners } from "@/components/ui";
import { AskInput } from "./ask-input";
import { Answer } from "./answer";
import { Stages } from "./stages";
import { Sources } from "./sources";
import { Claims, Contradictions, Faithfulness } from "./verification";

const INITIAL: AskState = { stage: "idle", citations: [], answer: "", claims: [], contradictions: [] };

const EXAMPLES = [
  "How are generative world models used in autonomous driving?",
  "How do agents stay policy-compliant when calling tools?",
  "Where do neural operators beat classical PDE solvers?",
  "What makes LLM-as-judge evaluations unreliable?",
  "How is mean-field theory applied to reinforcement learning?",
];

export function AskView() {
  const [state, setState] = useState<AskState>(INITIAL);
  const [question, setQuestion] = useState("");
  const [focused, setFocused] = useState<number | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setQuestion(q);
    setFocused(null);
    setState({ ...INITIAL, stage: "planning" });
    window.scrollTo({ top: 0 });
    const url = new URL(window.location.href);
    url.searchParams.set("q", q);
    window.history.replaceState(null, "", url);

    try {
      await askStream(q, (ev) => setState((prev) => reduce(prev, ev.event, ev.data)), controller.signal);
      // Stream closed without a terminal event: treat what arrived as final.
      setState((prev) => (prev.stage === "done" ? prev : { ...prev, stage: "done" }));
    } catch (err) {
      if (controller.signal.aborted) return;
      setState((prev) => ({ ...prev, stage: "done", error: describe(err) }));
    }
  }, []);

  useEffect(() => {
    setRuns(loadRuns());
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) run(q);
    return () => abortRef.current?.abort();
  }, [run]);

  // Log each completed, successful run to the notebook.
  useEffect(() => {
    if (state.stage !== "done" || !state.answer || !question) return;
    setRuns(
      saveRun({
        question,
        at: Date.now(),
        faithfulness: state.claims.length ? state.faithfulness : undefined,
        claims: state.claims.length || undefined,
        sources: new Set(state.citations.map((c) => c.arxiv_id)).size,
        latency_ms: state.latency_ms,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage]);

  const reset = () => {
    abortRef.current?.abort();
    setQuestion("");
    setState(INITIAL);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const active = state.stage !== "idle";

  return (
    <div className="mx-auto grid w-full max-w-page flex-1 gap-10 px-5 pb-24 pt-8 sm:px-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
      <Notebook
        runs={runs}
        current={active ? question : null}
        onPick={run}
        onNew={reset}
        onClear={() => {
          clearRuns();
          setRuns([]);
        }}
      />

      <div className="min-w-0 lg:order-none">
        <AnimatePresence mode="wait" initial={false}>
          {!active ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.4, ease }}
              className="lg:pt-10"
            >
              <div className="label flex items-center gap-3">
                <span className="text-blue">Console</span>
                <span className="h-px w-8 bg-line" />
              </div>
              <h1 className="mt-4 text-[38px] font-light leading-[1.05] tracking-[-0.03em] sm:text-[52px]">
                What do you want to know?
              </h1>
              <div className="mt-10 max-w-[760px]">
                <AskInput onSubmit={run} autoFocus />
              </div>
              <div className="mt-12 max-w-[760px]">
                <div className="label">Suggested</div>
                <ul className="mt-3 border-t border-line">
                  {EXAMPLES.map((q, i) => (
                    <li key={q} className="border-b border-line">
                      <button
                        onClick={() => run(q)}
                        className="group flex w-full items-center gap-5 py-3.5 text-left text-[15px] text-ink-soft transition-colors hover:text-blue"
                      >
                        <span className="w-6 text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                        <span className="flex-1">{q}</span>
                        <ArrowRight className="h-4 w-4 -translate-x-1 text-blue opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
            >
              <Result
                question={question}
                state={state}
                focused={focused}
                setFocused={setFocused}
                onAsk={run}
                onReset={reset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Notebook({
  runs,
  current,
  onPick,
  onNew,
  onClear,
}: {
  runs: Run[];
  current: string | null;
  onPick: (q: string) => void;
  onNew: () => void;
  onClear: () => void;
}) {
  return (
    <aside className="order-last lg:order-first lg:sticky lg:top-24 lg:self-start">
      <button onClick={onNew} className="btn-ghost w-full justify-start">
        <Plus className="h-4 w-4" /> New question
      </button>
      <div className="mt-8 flex items-center justify-between">
        <span className="label">Notebook</span>
        {runs.length > 0 && (
          <button onClick={onClear} className="text-[11px] text-faint transition-colors hover:text-bad">
            Clear
          </button>
        )}
      </div>
      {runs.length === 0 ? (
        <p className="mt-3 border-t border-line pt-3 text-[13px] text-faint">No runs yet.</p>
      ) : (
        <ul className="mt-3 max-h-[60vh] overflow-y-auto border-t border-line">
          {runs.map((r) => (
            <li key={r.at}>
              <button
                onClick={() => onPick(r.question)}
                className={clsx(
                  "block w-full border-b border-line py-3 pl-3 pr-1 text-left transition-colors",
                  r.question === current ? "border-l-2 border-l-blue bg-blue-soft" : "hover:bg-ink/[0.025]",
                )}
              >
                <span className="line-clamp-2 text-[13px] leading-snug text-ink-soft">{r.question}</span>
                <span className="mt-1.5 flex gap-3 text-[11px] text-faint">
                  {typeof r.faithfulness === "number" && (
                    <span className={r.faithfulness >= 0.8 ? "text-ok" : "text-warn"}>
                      {Math.round(r.faithfulness * 100)}% verified
                    </span>
                  )}
                  {r.sources ? <span>{r.sources} sources</span> : null}
                  {r.latency_ms ? <span>{(r.latency_ms / 1000).toFixed(1)} s</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Result({
  question,
  state,
  focused,
  setFocused,
  onAsk,
  onReset,
}: {
  question: string;
  state: AskState;
  focused: number | null;
  setFocused: (i: number | null) => void;
  onAsk: (q: string) => void;
  onReset: () => void;
}) {
  const busy = state.stage !== "done";
  const failed = Boolean(state.error) && !state.answer;
  const hasVerification = typeof state.faithfulness === "number" && state.claims.length > 0;
  const sourceIds = [...new Set(state.citations.map((c) => c.arxiv_id))];

  return (
    <>
      <AskInput onSubmit={onAsk} initial={question} size="sm" busy={busy} />

      <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-14 xl:grid-cols-[minmax(0,1fr)_290px]">
        <article className="min-w-0 max-w-read">
          <h1 className="text-[30px] font-light leading-[1.15] tracking-[-0.025em] text-ink sm:text-[36px]">
            {question}
          </h1>
          <div className="mt-7">
            <Stages stage={state.stage} failed={failed} />
          </div>

          <div className="mt-9">
            {failed ? (
              <ErrorBlock message={state.error!} onRetry={() => onAsk(question)} />
            ) : state.answer ? (
              <Answer
                markdown={state.answer}
                citations={state.citations}
                streaming={state.stage === "synthesizing"}
                onCiteFocus={setFocused}
              />
            ) : (
              <Skeleton />
            )}
          </div>

          {state.answer && state.error && (
            <p className="mt-6 border-l-2 border-warn/60 pl-3 text-[13px] leading-relaxed text-muted">
              Verification did not complete for this answer. Citations above are unaffected.
            </p>
          )}

          <AnimatePresence>
            {hasVerification && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
                className="mt-14 space-y-12"
              >
                <Claims claims={state.claims} />
                <Contradictions items={state.contradictions} />
              </motion.div>
            )}
          </AnimatePresence>

          {state.stage === "done" && !failed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-5 text-[12.5px] text-muted"
            >
              {state.model && <span>{state.model}</span>}
              {typeof state.latency_ms === "number" && <span>{(state.latency_ms / 1000).toFixed(1)} s</span>}
              {sourceIds.length > 0 && (
                <Link href={`/atlas?ids=${sourceIds.join(",")}`} className="text-blue hover:underline">
                  Locate sources in atlas
                </Link>
              )}
              <button onClick={onReset} className="ml-auto transition-colors hover:text-ink">
                New question
              </button>
            </motion.div>
          )}
        </article>

        <aside className="space-y-10 xl:sticky xl:top-24 xl:self-start">
          <AnimatePresence>
            {hasVerification && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
                className="panel p-5"
              >
                <Corners />
                <Faithfulness value={state.faithfulness!} claims={state.claims} />
              </motion.div>
            )}
          </AnimatePresence>
          {state.citations.length > 0 ? (
            <Sources citations={state.citations} focused={focused} />
          ) : (
            busy && (
              <div className="space-y-3">
                <div className="label">Sources</div>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-10 rounded" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )
          )}
        </aside>
      </div>
    </>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="panel p-6">
      <Corners />
      <p className="text-[19px] font-light leading-snug text-ink">{message}</p>
      <button onClick={onRetry} className="btn-primary mt-5">
        <RotateCw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[100, 97, 92, 99, 64].map((w, i) => (
        <div key={i} className="skeleton h-[14px] rounded" style={{ width: `${w}%`, animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

function describe(err: unknown): string {
  if (err instanceof AskError) {
    if (err.status === 429) return "Too many questions at once. Give it a minute.";
    if (err.status === 422 && err.detail) return err.detail;
    if (err.status === 503) return "The language model is at capacity right now.";
  }
  return "The research engine didn't respond.";
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
    case "error":
      return { ...prev, stage: "done", error: "The language model is at capacity right now." };
    case "done": {
      const d = data as { model: string; cost_usd: number; latency_ms: number };
      return { ...prev, stage: "done", model: d.model, cost_usd: d.cost_usd, latency_ms: d.latency_ms };
    }
    default:
      return prev;
  }
}
