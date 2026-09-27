"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import type { AskStage } from "@/lib/types";

const STEPS: { key: AskStage; label: string }[] = [
  { key: "planning", label: "Plan" },
  { key: "retrieving", label: "Retrieve" },
  { key: "synthesizing", label: "Write" },
  { key: "verifying", label: "Verify" },
];

const ORDER: AskStage[] = ["idle", "planning", "retrieving", "synthesizing", "verifying", "done"];

export function Stages({ stage, failed }: { stage: AskStage; failed?: boolean }) {
  const current = ORDER.indexOf(stage);
  const progress = Math.min(Math.max(current - 1, 0) + (stage === "done" ? 1 : 0.5), 4) / 4;

  return (
    <div>
      <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-label">
        {STEPS.map((s) => {
          const pos = ORDER.indexOf(s.key);
          const done = current > pos;
          const active = current === pos && !failed;
          return (
            <span
              key={s.key}
              className={clsx(
                "flex items-center gap-1.5 transition-colors duration-300",
                done ? "text-ink" : active ? "text-accent" : "text-faint",
              )}
            >
              <span
                className={clsx(
                  "h-1 w-1 rounded-full",
                  done ? "bg-ink" : active ? "animate-pulse bg-accent" : "bg-faint/60",
                )}
              />
              {s.label}
            </span>
          );
        })}
      </div>
      <div className="mt-3 h-px w-full overflow-hidden bg-line">
        <motion.div
          className={clsx("h-full origin-left", failed ? "bg-warn" : stage === "done" ? "bg-ink" : "bg-accent")}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
