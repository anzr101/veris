"use client";

import { motion } from "framer-motion";

export function FaithfulnessMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const r = 30;
  const c = 2 * Math.PI * r;
  const color = value >= 0.8 ? "#3ee6c4" : value >= 0.5 ? "#f5c46b" : "#f0707f";

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[76px] w-[76px]">
        <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
          <circle cx="38" cy="38" r={r} fill="none" stroke="#26262d" strokeWidth="6" />
          <motion.circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - value) }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-lg font-medium" style={{ color }}>
            {pct}
            <span className="text-[10px] text-mist">%</span>
          </span>
        </div>
      </div>
      <div>
        <div className="kicker">Faithfulness</div>
        <div className="mt-1 max-w-[180px] text-[12.5px] leading-snug text-mist">
          Share of claims independently verified as entailed by their cited evidence.
        </div>
      </div>
    </div>
  );
}
