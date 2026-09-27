"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { MapArtifact } from "@/lib/types";
import { topicColor } from "@/lib/palette";

/** A still of the atlas: every paper in the corpus as a point, coloured by topic. */
export function AtlasPreview({ artifact }: { artifact: MapArtifact }) {
  const W = 1116;
  const H = 190;

  const points = useMemo(() => {
    const xs = artifact.nodes.map((n) => n.x);
    const ys = artifact.nodes.map((n) => n.y);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    // Stretch the cloud into a wide band.
    return artifact.nodes.map((n, i) => ({
      i,
      x: 20 + ((n.x - x0) / (x1 - x0 || 1)) * (W - 40),
      y: 10 + ((n.y - y0) / (y1 - y0 || 1)) * (H - 20),
      c: topicColor(n.cluster),
    }));
  }, [artifact]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {points.map((p) => (
        <motion.circle
          key={p.i}
          cx={p.x}
          cy={p.y}
          r={2.6}
          fill={p.c}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.3 + (p.x / W) * 0.9, duration: 0.6 }}
        />
      ))}
    </svg>
  );
}
