"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { Cluster, MapEdge, MapNode } from "@/lib/types";

interface Props {
  nodes: MapNode[];
  clusters: Cluster[];
  edges: MapEdge[];
  maxYear: number | null; // show nodes with year <= maxYear (null = all)
  showEdges: boolean;
  highlight: Set<number> | null; // paper_ids to emphasize (others dim)
  selectedId: number | null;
  onHover: (node: MapNode | null) => void;
  onSelect: (node: MapNode) => void;
}

const easeOutExpo = (t: number) => 1 - Math.pow(2, -10 * Math.min(Math.max(t, 0), 1));

export function MapCanvas({
  nodes,
  clusters,
  edges,
  maxYear,
  showEdges,
  highlight,
  selectedId,
  onHover,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Mutable render state (read inside the rAF loop; not React state to avoid re-renders).
  const view = useRef({ scale: 5, x: 0, y: 0, fitted: false });
  const reveal = useRef<Map<number, number>>(new Map());
  const mountAt = useRef<number>(0);
  const drag = useRef<{ on: boolean; moved: boolean; px: number; py: number }>({
    on: false, moved: false, px: 0, py: 0,
  });
  const hoverIdx = useRef<number>(-1);

  // Latest props for the loop.
  const propsRef = useRef<Props>({ nodes, clusters, edges, maxYear, showEdges, highlight, selectedId, onHover, onSelect });
  propsRef.current = { nodes, clusters, edges, maxYear, showEdges, highlight, selectedId, onHover, onSelect };

  const clusterColor = useRef<Map<number, string>>(new Map());
  clusterColor.current = new Map(clusters.map((c) => [c.id, c.color]));

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    mountAt.current = performance.now();

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cssW = 0;
    let cssH = 0;

    const resize = () => {
      cssW = wrap.clientWidth;
      cssH = wrap.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      if (!view.current.fitted) fit();
    };

    const fit = () => {
      const s = (Math.min(cssW, cssH) * 0.82) / 100;
      view.current = { scale: s, x: cssW / 2 - 50 * s, y: cssH / 2 - 50 * s, fitted: true };
    };

    const w2s = (wx: number, wy: number) => ({
      x: wx * view.current.scale + view.current.x,
      y: wy * view.current.scale + view.current.y,
    });

    const visible = (n: MapNode) =>
      propsRef.current.maxYear === null || n.year === null || n.year <= propsRef.current.maxYear;

    let raf = 0;
    const frame = (now: number) => {
      const p = propsRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      // Edges (faint, behind nodes)
      if (p.showEdges) {
        ctx.lineWidth = 1;
        for (const e of p.edges) {
          const a = p.nodes[e.source];
          const b = p.nodes[e.target];
          if (!a || !b || !visible(a) || !visible(b)) continue;
          const pa = w2s(a.x, a.y);
          const pb = w2s(b.x, b.y);
          ctx.strokeStyle =
            e.kind === "coauthor" ? "rgba(245,196,107,0.07)" : "rgba(120,140,160,0.05)";
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        }
      }

      // Nodes
      for (let i = 0; i < p.nodes.length; i++) {
        const n = p.nodes[i];
        if (!visible(n)) {
          reveal.current.delete(n.paper_id);
          continue;
        }
        // reveal timing: entrance stagger on mount, or fade-in when slider reveals it
        let start = reveal.current.get(n.paper_id);
        if (start === undefined) {
          start = reduce ? 0 : now + Math.min(i * 6, 500);
          reveal.current.set(n.paper_id, start);
        }
        const prog = reduce ? 1 : easeOutExpo((now - start) / 520);
        if (prog <= 0) continue;

        const { x, y } = w2s(n.x, n.y);
        const color = clusterColor.current.get(n.cluster) || "#3ee6c4";
        const isHi = p.highlight ? p.highlight.has(n.paper_id) : true;
        const dim = p.highlight && !isHi;
        const selected = p.selectedId === n.paper_id;
        const hovered = hoverIdx.current === i;

        const pulse = isHi && p.highlight ? 1 + 0.25 * Math.sin(now / 320) : 1;
        const baseR = (selected || hovered ? 5.2 : 3.2) * prog * pulse;
        const alpha = (dim ? 0.16 : 1) * prog;

        // soft halo (cheap, no shadowBlur)
        ctx.globalAlpha = alpha * (dim ? 0.1 : 0.22);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, baseR * 3.4, 0, Math.PI * 2);
        ctx.fill();

        // core
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, baseR, 0, Math.PI * 2);
        ctx.fill();

        if (selected || hovered) {
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = "#ECECE6";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(x, y, baseR + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Cluster labels — largest first, with greedy collision avoidance so the dense
      // centre doesn't turn into a pile of overlapping text.
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "600 11px var(--font-mono), monospace";
      const drawn: { x: number; y: number; w: number }[] = [];
      const ordered = [...p.clusters].sort((a, b) => b.size - a.size);
      for (const c of ordered) {
        const { x, y } = w2s(c.x, c.y);
        if (x < 40 || x > cssW - 40 || y < 30 || y > cssH - 30) continue;
        const label = c.label.toUpperCase();
        const tw = ctx.measureText(label).width;
        const collides = drawn.some(
          (d) => Math.abs(d.x - x) < (d.w + tw) / 2 + 14 && Math.abs(d.y - y) < 26,
        );
        if (collides) continue;
        drawn.push({ x, y, w: tw });

        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(9,9,11,0.82)";
        roundRect(ctx, x - tw / 2 - 9, y - 11, tw + 18, 22, 11);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = c.color;
        ctx.fillText(label, x, y + 1);
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    };

    // ── interaction ────────────────────────────────────────────────────────────────
    const hitTest = (px: number, py: number): number => {
      let best = -1;
      let bestD = 14 * 14;
      const p = propsRef.current;
      for (let i = 0; i < p.nodes.length; i++) {
        const n = p.nodes[i];
        if (!visible(n)) continue;
        const s = w2s(n.x, n.y);
        const d = (s.x - px) ** 2 + (s.y - py) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0014);
      const v = view.current;
      const ns = Math.min(Math.max(v.scale * factor, 1.2), 60);
      // keep world point under cursor fixed
      v.x = mx - ((mx - v.x) * ns) / v.scale;
      v.y = my - ((my - v.y) * ns) / v.scale;
      v.scale = ns;
    };
    const onDown = (e: PointerEvent) => {
      drag.current = { on: true, moved: false, px: e.clientX, py: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (drag.current.on) {
        const dx = e.clientX - drag.current.px;
        const dy = e.clientY - drag.current.py;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
        view.current.x += dx;
        view.current.y += dy;
        drag.current.px = e.clientX;
        drag.current.py = e.clientY;
        return;
      }
      const idx = hitTest(mx, my);
      if (idx !== hoverIdx.current) {
        hoverIdx.current = idx;
        canvas.style.cursor = idx >= 0 ? "pointer" : "grab";
        propsRef.current.onHover(idx >= 0 ? propsRef.current.nodes[idx] : null);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (drag.current.on && !drag.current.moved && hoverIdx.current >= 0) {
        propsRef.current.onSelect(propsRef.current.nodes[hoverIdx.current]);
      }
      drag.current.on = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };
    const onLeave = () => {
      hoverIdx.current = -1;
      propsRef.current.onHover(null);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="h-full w-full touch-none" style={{ cursor: "grab" }} />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
