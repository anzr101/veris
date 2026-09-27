"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { Cluster, MapEdge, MapNode } from "@/lib/types";
import { topicColor } from "@/lib/palette";

interface Props {
  nodes: MapNode[];
  clusters: Cluster[];
  edges: MapEdge[];
  highlight: Set<number> | null; // paper_ids to emphasise; others recede
  topic: number | null; // cluster id to emphasise
  selectedId: number | null;
  onHover: (node: MapNode | null) => void;
  onSelect: (node: MapNode | null) => void;
}

export interface AtlasHandle {
  zoom: (factor: number) => void;
  reset: () => void;
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const HALO = "#061129";
const INK = "#FFFFFF";

export const AtlasCanvas = forwardRef<AtlasHandle, Props>(function AtlasCanvas(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const view = useRef({ scale: 5, x: 0, y: 0 });
  const target = useRef({ scale: 5, x: 0, y: 0 });
  const size = useRef({ w: 0, h: 0 });
  const bounds = useRef({ x0: 0, y0: 0, x1: 100, y1: 100 });
  const hoverIdx = useRef(-1);
  const drag = useRef({ on: false, moved: false, px: 0, py: 0 });
  const propsRef = useRef(props);
  propsRef.current = props;

  const fit = () => {
    const { w, h } = size.current;
    const b = bounds.current;
    const bw = b.x1 - b.x0 || 1;
    const bh = b.y1 - b.y0 || 1;
    // On wide screens the topic list occupies the left edge; centre the map beside it.
    const inset = w >= 768 ? 290 + Math.max(20, (w - 1240) / 2 + 32) : 0;
    const aw = w - inset;
    const s = Math.min((aw * 0.84) / bw, (h * 0.8) / bh);
    target.current = {
      scale: s,
      x: inset + aw / 2 - ((b.x0 + b.x1) / 2) * s,
      y: h / 2 - ((b.y0 + b.y1) / 2) * s,
    };
  };

  const zoomAt = (factor: number, mx: number, my: number) => {
    const t = target.current;
    const ns = Math.min(Math.max(t.scale * factor, 1.5), 90);
    t.x = mx - ((mx - t.x) * ns) / t.scale;
    t.y = my - ((my - t.y) * ns) / t.scale;
    t.scale = ns;
  };

  useImperativeHandle(ref, () => ({
    zoom: (f) => zoomAt(f, size.current.w / 2, size.current.h / 2),
    reset: fit,
  }));

  useEffect(() => {
    const xs = props.nodes.map((n) => n.x);
    const ys = props.nodes.map((n) => n.y);
    if (xs.length) {
      bounds.current = {
        x0: Math.min(...xs),
        x1: Math.max(...xs),
        y0: Math.min(...ys),
        y1: Math.max(...ys),
      };
    }
  }, [props.nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const born = performance.now();
    let dpr = 1;
    let first = true;

    const resize = () => {
      size.current = { w: wrap.clientWidth, h: wrap.clientHeight };
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(size.current.w * dpr);
      canvas.height = Math.floor(size.current.h * dpr);
      canvas.style.width = `${size.current.w}px`;
      canvas.style.height = `${size.current.h}px`;
      if (first) {
        fit();
        view.current = { ...target.current };
        first = false;
      }
    };

    const w2s = (x: number, y: number) => ({
      x: x * view.current.scale + view.current.x,
      y: y * view.current.scale + view.current.y,
    });

    let raf = 0;
    const frame = (now: number) => {
      const p = propsRef.current;
      const { w, h } = size.current;

      // Glide the view toward its target so zoom and reset feel physical.
      const k = reduce ? 1 : 0.18;
      const v = view.current;
      const t = target.current;
      v.scale += (t.scale - v.scale) * k;
      v.x += (t.x - v.x) * k;
      v.y += (t.y - v.y) * k;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const emphasised = (n: MapNode) =>
        (p.highlight ? p.highlight.has(n.paper_id) : true) && (p.topic === null || n.cluster === p.topic);
      const focusing = p.highlight !== null || p.topic !== null;

      // Edges
      ctx.lineWidth = 0.75;
      for (const e of p.edges) {
        const a = p.nodes[e.source];
        const b = p.nodes[e.target];
        if (!a || !b) continue;
        const on = !focusing || (emphasised(a) && emphasised(b));
        ctx.strokeStyle = on ? "rgba(120,155,255,0.13)" : "rgba(120,155,255,0.035)";
        const pa = w2s(a.x, a.y);
        const pb = w2s(b.x, b.y);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Nodes, revealed left to right on arrival.
      const r0 = Math.min(2.4 + v.scale * 0.03, 4.5);
      for (let i = 0; i < p.nodes.length; i++) {
        const n = p.nodes[i];
        const s = w2s(n.x, n.y);
        if (s.x < -20 || s.x > w + 20 || s.y < -20 || s.y > h + 20) continue;
        const delay = reduce ? 0 : (s.x / Math.max(w, 1)) * 700;
        const prog = reduce ? 1 : easeOut((now - born - delay) / 600);
        if (prog <= 0) continue;

        const on = emphasised(n);
        const sel = p.selectedId === n.paper_id;
        const hov = hoverIdx.current === i;
        const pulse = p.highlight && on && !reduce ? 1 + 0.18 * Math.sin(now / 300) : 1;
        const r = (sel || hov ? r0 + 2 : r0) * prog * (p.highlight && on ? 1.35 * pulse : 1);

        ctx.globalAlpha = (focusing && !on ? 0.12 : 0.95) * prog;
        ctx.fillStyle = topicColor(n.cluster);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (sel || hov) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.arc(s.x, s.y, r + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Topic labels, largest topics first,
      // skipping any that would collide.
      const labelProg = reduce ? 1 : easeOut((now - born - 500) / 700);
      if (labelProg > 0) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `500 ${Math.round(11 + Math.min(v.scale / 16, 3))}px "IBM Plex Sans", system-ui, sans-serif`;
        (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "1px";
        const placed: { x: number; y: number; w: number }[] = [];
        for (const c of [...p.clusters].sort((a, b) => b.size - a.size)) {
          const s = w2s(c.x, c.y);
          if (s.x < 60 || s.x > w - 60 || s.y < 30 || s.y > h - 30) continue;
          const text = c.label.toUpperCase();
          const tw = ctx.measureText(text).width;
          if (placed.some((d) => Math.abs(d.x - s.x) < (d.w + tw) / 2 + 12 && Math.abs(d.y - s.y) < 24)) continue;
          placed.push({ x: s.x, y: s.y, w: tw });
          const dim = p.topic !== null && p.topic !== c.id;
          ctx.globalAlpha = labelProg * (dim ? 0.25 : 0.92);
          ctx.lineJoin = "round";
          ctx.lineWidth = 5;
          ctx.strokeStyle = HALO;
          ctx.strokeText(text, s.x, s.y);
          ctx.fillStyle = INK;
          ctx.fillText(text, s.x, s.y);
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(frame);
    };

    const hitTest = (px: number, py: number) => {
      const p = propsRef.current;
      let best = -1;
      let bestD = 12 * 12;
      for (let i = 0; i < p.nodes.length; i++) {
        const s = w2s(p.nodes[i].x, p.nodes[i].y);
        const d = (s.x - px) ** 2 + (s.y - py) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    };

    const local = (e: { clientX: number; clientY: number }) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = local(e);
      zoomAt(Math.exp(-e.deltaY * 0.0015), m.x, m.y);
    };
    const onDown = (e: PointerEvent) => {
      drag.current = { on: true, moved: false, px: e.clientX, py: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (drag.current.on) {
        const dx = e.clientX - drag.current.px;
        const dy = e.clientY - drag.current.py;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
        target.current.x += dx;
        target.current.y += dy;
        view.current.x += dx;
        view.current.y += dy;
        drag.current.px = e.clientX;
        drag.current.py = e.clientY;
        canvas.style.cursor = "grabbing";
        return;
      }
      const m = local(e);
      const idx = hitTest(m.x, m.y);
      if (idx !== hoverIdx.current) {
        hoverIdx.current = idx;
        canvas.style.cursor = idx >= 0 ? "pointer" : "grab";
        propsRef.current.onHover(idx >= 0 ? propsRef.current.nodes[idx] : null);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (drag.current.on && !drag.current.moved) {
        const m = local(e);
        const idx = hitTest(m.x, m.y);
        propsRef.current.onSelect(idx >= 0 ? propsRef.current.nodes[idx] : null);
      }
      drag.current.on = false;
      canvas.style.cursor = hoverIdx.current >= 0 ? "pointer" : "grab";
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
});
