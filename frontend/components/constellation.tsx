"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Drifting star-map backdrop — the visual signature of the hero. ~64 gold points
 * with faint links between close neighbors, like an unfinished map of a field.
 * Canvas-drawn (transform/opacity only, no layout), capped DPR, and static when
 * the user prefers reduced motion.
 */
export function Constellation({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const N = 64;
    const LINK = 130; // px within which two points get a hairline
    const pts = Array.from({ length: N }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00016,
      vy: (Math.random() - 0.5) * 0.00016,
      r: Math.random() * 1.3 + 0.6,
      tw: Math.random() * Math.PI * 2, // twinkle phase
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let raf = 0;
    const frame = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < N; i++) {
        const a = pts[i];
        if (!reduce) {
          a.x += a.vx;
          a.y += a.vy;
          if (a.x < 0 || a.x > 1) a.vx *= -1;
          if (a.y < 0 || a.y > 1) a.vy *= -1;
        }
        for (let j = i + 1; j < N; j++) {
          const b = pts[j];
          const dx = (a.x - b.x) * w;
          const dy = (a.y - b.y) * h;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.globalAlpha = (1 - Math.sqrt(d2) / LINK) * 0.09;
            ctx.strokeStyle = "#D8B26A";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        const tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(t / 900 + p.tw);
        ctx.globalAlpha = 0.5 * tw;
        ctx.fillStyle = "#D8B26A";
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduce]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
