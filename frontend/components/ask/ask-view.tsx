"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, RotateCw } from "lucide-react";
import { AskError, askStream, getMap, getStats } from "@/lib/api";
import type {
  AskState,
  Citation,
  ClaimVerification,
  Contradiction,
  MapArtifact,
  QueryPlan,
  Stats,
} from "@/lib/types";
import { ease } from "@/lib/motion";
import { AskInput } from "./ask-input";
import { Answer } from "./answer";
import { Stages } from "./stages";
import { Sources } from "./sources";
import { Claims, Contradictions, Faithfulness } from "./verification";
import { AtlasPreview } from "@/components/atlas/atlas-preview";

const INITIAL: AskState = { stage: "idle", citations: [], answer: "", claims: [], contradictions: [] };

const EXAMPLES = [
  "How are generative world models used in autonomous driving?",
  "How do agents stay policy-compliant when calling tools?",
  "Where do neural operators beat classical PDE solvers?",
];

export function AskView() {
  const [state, setState] = useState<AskState>(INITIAL);
  const [question, setQuestion] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [map, setMap] = useState<MapArtifact | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
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
    getStats().then(setStats).catch(() => {});
    getMap().then(setMap).catch(() => {});
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) run(q);
    return () => abortRef.current?.abort();
  }, [run]);

  const reset = () => {
    abortRef.current?.abort();
    setQuestion("");
    setState(INITIAL);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const active = state.stage !== "idle";

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!active ? (
        <motion.div
          key="home"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          className="flex flex-1 flex-col"
        >
          <Home onAsk={run} stats={stats} map={map} />
        </motion.div>
      ) : (
        <motion.div
          key="result"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="mx-auto w-full max-w-page px-5 pb-24 pt-6 sm:px-8"
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
  );
}

function Home({
  onAsk,
  stats,
  map,
}: {
  onAsk: (q: string) => void;
  stats: Stats | null;
  map: MapArtifact | null;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-[760px] px-5 pt-[10vh] sm:px-8 sm:pt-[14vh]">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="text-center font-serif font-normal leading-[0.95] tracking-[-0.025em] text-ink"
          style={{ fontSize: "clamp(3.1rem, 8vw, 6rem)" }}
        >
          Ask the <em className="italic">literature</em>.
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.8, ease }}
          className="mt-10 sm:mt-12"
        >
          <AskInput onSubmit={onAsk} autoFocus />
        </motion.div>

        <motion.ul
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } } }}
          className="mt-6 flex flex-col items-stretch gap-0.5"
        >
          {EXAMPLES.map((q) => (
            <motion.li
              key={q}
              variants={{
                hidden: { opacity: 0, y: 6 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
              }}
            >
              <button
                onClick={() => onAsk(q)}
                className="group flex w-full items-center justify-between gap-4 rounded-xl px-4 py-2.5 text-left text-[14.5px] text-muted transition-colors duration-200 hover:bg-ink/[0.035] hover:text-ink"
              >
                <span>{q}</span>
                <ArrowRight className="h-3.5 w-3.5 flex-none -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
              </button>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="mx-auto mt-auto w-full max-w-page px-5 pb-8 pt-12 sm:px-8"
      >
        <Link href="/atlas" className="group block" aria-label="Open the atlas">
          <div className="hidden h-[190px] sm:block">
            {map && map.nodes.length > 0 && <AtlasPreview artifact={map} />}
          </div>
          <div className="flex items-center justify-between border-t border-line pt-4 font-mono text-[11.5px] text-muted sm:mt-5">
            <span className="num flex flex-wrap gap-x-6 gap-y-1">
              {stats ? (
                <>
                  <span><span className="text-ink">{stats.papers.toLocaleString()}</span> papers</span>
                  <span><span className="text-ink">{stats.chunks.toLocaleString()}</span> passages</span>
                  {map && <span className="hidden sm:inline"><span className="text-ink">{map.clusters.length}</span> topics</span>}
                </>
              ) : (
                <span className="skeleton h-3 w-48 rounded" />
              )}
            </span>
            <span className="flex items-center gap-1.5 transition-colors group-hover:text-ink">
              Atlas
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      </motion.section>
    </div>
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

  return (
    <>
      <div className="mx-auto max-w-[760px]">
        <AskInput onSubmit={onAsk} initial={question} size="sm" busy={busy} />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0 max-w-read">
          <h1 className="font-serif text-[34px] font-normal leading-[1.1] tracking-[-0.015em] text-ink sm:text-[42px]">
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
              className="num mt-14 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 font-mono text-[11.5px] text-muted"
            >
              {state.model && <span>{state.model}</span>}
              {typeof state.latency_ms === "number" && <span>{(state.latency_ms / 1000).toFixed(1)}s</span>}
              {state.citations.length > 0 && (
                <Link
                  href={`/atlas?ids=${[...new Set(state.citations.map((c) => c.arxiv_id))].join(",")}`}
                  className="text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
                >
                  Locate sources in atlas
                </Link>
              )}
              <button onClick={onReset} className="ml-auto transition-colors hover:text-ink">
                New question
              </button>
            </motion.div>
          )}
        </article>

        <aside className="space-y-12 lg:sticky lg:top-24 lg:self-start">
          <AnimatePresence>
            {hasVerification && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
              >
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
                  <div key={i} className="skeleton h-10 rounded-lg" style={{ animationDelay: `${i * 0.1}s` }} />
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
    <div className="rounded-2xl border border-line bg-surface p-6">
      <p className="font-serif text-[22px] leading-snug text-ink">{message}</p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13.5px] text-paper transition-colors hover:bg-accent"
      >
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
        <div
          key={i}
          className="skeleton h-[14px] rounded"
          style={{ width: `${w}%`, animationDelay: `${i * 0.08}s` }}
        />
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
