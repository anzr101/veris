"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { AskStage } from "@/lib/types";

const STEPS: { key: AskStage; label: string }[] = [
  { key: "planning", label: "Plan" },
  { key: "retrieving", label: "Retrieve" },
  { key: "synthesizing", label: "Synthesize" },
  { key: "verifying", label: "Verify" },
];

const ORDER: AskStage[] = ["idle", "planning", "retrieving", "synthesizing", "verifying", "done"];

export function Pipeline({ stage }: { stage: AskStage }) {
  const current = ORDER.indexOf(stage);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const pos = ORDER.indexOf(step.key);
        const done = current > pos;
        const active = current === pos;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <motion.div
              initial={false}
              animate={{ opacity: done || active ? 1 : 0.4, scale: active ? 1.04 : 1 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={clsx(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]",
                active && "border-signal/50 bg-signal/10 text-signal",
                done && "border-signal/30 text-signal/80",
                !active && !done && "border-white/10 text-mist",
              )}
            >
              {done ? (
                <Check className="h-3 w-3" />
              ) : active ? (
                <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
              {step.label}
            </motion.div>
            {i < STEPS.length - 1 && (
              // Connector fills with gold as the stage completes.
              <span className="relative h-px w-5 overflow-hidden bg-white/10">
                <motion.span
                  initial={false}
                  animate={{ scaleX: done ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 origin-left bg-signal/70"
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
