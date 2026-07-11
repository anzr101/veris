"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUp, Sparkles } from "lucide-react";
import { easeOutExpo } from "@/lib/motion";

const EXAMPLES = [
  "How do retrieval-augmented methods reduce hallucination in LLMs?",
  "What improves sample efficiency in multi-agent reinforcement learning?",
  "How is classifier-free guidance used in diffusion models?",
];

export function AskConsole({
  onSubmit,
  disabled,
}: {
  onSubmit: (q: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const q = value.trim();
    if (q.length >= 3 && !disabled) onSubmit(q);
  };

  return (
    <div className="w-full">
      <div
        className="group relative rounded-2xl border border-white/10 bg-ink-50/60 p-2 shadow-lift
                   backdrop-blur-xl transition-colors duration-300 focus-within:border-signal/40 focus-within:shadow-glow"
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Ask a research question…"
          disabled={disabled}
          className="w-full resize-none bg-transparent px-4 py-3 text-[16px] text-bone
                     placeholder:text-mist/60 focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-mist">
            <Sparkles className="h-3.5 w-3.5 text-signal/70" />
            grounded · cited · verified
          </span>
          <span className="flex items-center gap-3">
            <kbd className="hidden rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-faint sm:inline">
              ↵ Enter
            </kbd>
            <motion.button
              onClick={submit}
              disabled={disabled || value.trim().length < 3}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal text-ink
                         disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-mist"
              aria-label="Ask"
            >
              <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.5} />
            </motion.button>
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {EXAMPLES.map((ex, i) => (
          <motion.button
            key={ex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 + i * 0.08, duration: 0.45, ease: easeOutExpo }}
            onClick={() => onSubmit(ex)}
            disabled={disabled}
            className="chip group justify-between text-left sm:justify-start"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="font-mono text-[10px] tracking-[0.15em] text-signal/60">
                0{i + 1}
              </span>
              <span className="truncate">{ex}</span>
            </span>
            <ArrowRight className="h-3 w-3 flex-none -translate-x-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
