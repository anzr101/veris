import { memo } from "react";
import type { MapNode } from "@/lib/types";

interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** A topic's footprint on the atlas: its papers in colour over the whole corpus in grey. */
export const TopicThumb = memo(function TopicThumb({
  nodes,
  bounds,
  cluster,
  color,
}: {
  nodes: MapNode[];
  bounds: Bounds;
  cluster: number;
  color: string;
}) {
  const W = 200;
  const H = 120;
  const sx = (x: number) => 8 + ((x - bounds.x0) / (bounds.x1 - bounds.x0 || 1)) * (W - 16);
  const sy = (y: number) => 8 + ((y - bounds.y0) / (bounds.y1 - bounds.y0 || 1)) * (H - 16);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden>
      {nodes.map((n) =>
        n.cluster === cluster ? null : (
          <circle key={n.paper_id} cx={sx(n.x)} cy={sy(n.y)} r={1} fill="rgba(10,20,40,0.13)" />
        ),
      )}
      {nodes.map((n) =>
        n.cluster === cluster ? (
          <circle key={n.paper_id} cx={sx(n.x)} cy={sy(n.y)} r={2} fill={color} />
        ) : null,
      )}
    </svg>
  );
});
