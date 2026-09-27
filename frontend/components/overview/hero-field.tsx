"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { MapArtifact } from "@/lib/types";
import { topicColor } from "@/lib/palette";

/**
 * The corpus as a live specimen: every paper a point, semantic links between them, and
 * a scan line sweeping across that briefly excites the points it passes.
 */
export function HeroField({ map }: { map: MapArtifact }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const xs = map.nodes.map((n) => n.x);
    const ys = map.nodes.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const phase = map.nodes.map((_, i) => (i * 2.399) % (Math.PI * 2));

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    };

    const pos = (i: number, t: number) => {
      const n = map.nodes[i];
      const pad = 34;
      const s = Math.min((w - pad * 2) / (x1 - x0 || 1), (h - pad * 2) / (y1 - y0 || 1));
      const ox = (w - (x1 - x0) * s) / 2;
      const oy = (h - (y1 - y0) * s) / 2;
      const drift = reduce ? 0 : 1.6;
      return {
        x: ox + (n.x - x0) * s + Math.sin(t / 2400 + phase[i]) * drift,
        y: oy + (n.y - y0) * s + Math.cos(t / 2800 + phase[i]) * drift,
      };
    };

    const born = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = now - born;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const pts = map.nodes.map((_, i) => pos(i, t));
      const reveal = reduce ? 1 : Math.min(t / 1400, 1);
      // Scan line: a full sweep every 7s after the reveal.
      const scanX = reduce ? -999 : ((t % 7000) / 7000) * (w + 160) - 80;

      ctx.lineWidth = 0.6;
      for (const e of map.edges) {
        if (e.kind !== "semantic") continue;
        const a = pts[e.source];
        const b = pts[e.target];
        if (!a || !b) continue;
        ctx.strokeStyle = `rgba(120,155,255,${0.1 * reveal})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const shown = reduce ? 1 : Math.min(Math.max((t - (p.x / w) * 900) / 500, 0), 1);
        if (shown <= 0) continue;
        const d = Math.abs(p.x - scanX);
        const excite = d < 60 ? 1 - d / 60 : 0;
        const color = topicColor(map.nodes[i].cluster);

        if (excite > 0) {
          ctx.globalAlpha = excite * 0.35;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 7 * excite + 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = shown * (0.7 + 0.3 * excite);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.9 + excite * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (!reduce && scanX > -80) {
        const g = ctx.createLinearGradient(scanX - 70, 0, scanX, 0);
        g.addColorStop(0, "rgba(77,125,255,0)");
        g.addColorStop(1, "rgba(77,125,255,0.14)");
        ctx.fillStyle = g;
        ctx.fillRect(scanX - 70, 0, 70, h);
        ctx.fillStyle = "rgba(183,202,255,0.55)";
        ctx.fillRect(scanX, 0, 1, h);
      }

      raf = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [map, reduce]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden />;
}
