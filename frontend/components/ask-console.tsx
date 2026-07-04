"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";

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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="group relative rounded-2xl border border-white/10 bg-ink-50/60 p-2 shadow-lift
                   backdrop-blur-xl transition-colors focus-within:border-signal/40 focus-within:shadow-glow"
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
          <button
            onClick={submit}
            disabled={disabled || value.trim().length < 3}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal text-ink
                       transition-transform hover:scale-105 disabled:cursor-not-allowed
                       disabled:bg-white/10 disabled:text-mist"
            aria-label="Ask"
          >
            <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.5} />
          </button>
        </div>
      </motion.div>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => onSubmit(ex)} disabled={disabled} className="chip text-left">
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
