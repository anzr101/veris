"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Corners } from "@/components/ui";
import type { Stats } from "@/lib/types";

export function stagesFor(stats: Stats | null) {
  const utility = stats?.utility_model ?? "gpt-oss-20b";
  const synthesis = stats?.synthesis_model ?? "gpt-oss-120b";
  const embed = (stats?.embedding_model ?? "bge-small-en-v1.5").split("/").pop()!;
  return [
    { n: "01", name: "Plan", what: "Query decomposition", model: utility, param: "sub-queries + intent" },
    { n: "02", name: "Retrieve", what: "Dense + BM25, fused", model: embed, param: "RRF k = 60 · top 12" },
    { n: "03", name: "Synthesize", what: "Citation-bound answer", model: synthesis, param: "evidence only" },
    { n: "04", name: "Verify", what: "Claim entailment", model: utility, param: "per-claim verdict" },
  ];
}

/** Four stages on a rail, with a pulse travelling the rail to show direction of flow. */
export function PipelineDiagram({ stats }: { stats: Stats | null }) {
  const reduce = useReducedMotion();
  const stages = stagesFor(stats);

  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-[27px] hidden h-px bg-blue/25 md:block">
        {!reduce && (
          <motion.span
            className="absolute top-[-2px] h-[5px] w-16 rounded-full bg-gradient-to-r from-transparent via-blue to-transparent"
            animate={{ left: ["-5%", "100%"] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }}
          />
        )}
      </div>
      <ol className="relative grid gap-5 md:grid-cols-4">
        {stages.map((s, i) => (
          <motion.li
            key={s.n}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="relative z-10 flex h-[55px] w-[55px] items-center justify-center rounded-full border border-blue/30 bg-paper text-[13px] font-medium text-blue">
              {s.n}
            </div>
            <div className="panel mt-5 p-5">
              <Corners />
              <div className="text-[19px] font-medium tracking-[-0.01em]">{s.name}</div>
              <div className="mt-1 text-[13.5px] text-muted">{s.what}</div>
              <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-[12.5px]">
                <div className="flex justify-between gap-3">
                  <span className="text-faint">Model</span>
                  <span className="truncate text-ink-soft">{s.model}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-faint">Setting</span>
                  <span className="text-ink-soft">{s.param}</span>
                </div>
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
