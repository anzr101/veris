"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

/** Animates a number counting up to `value` (locale-formatted, tabular). */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
  }, [value, mv]);

  return <motion.span className={`font-mono ${className}`}>{display}</motion.span>;
}
