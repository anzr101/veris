"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getMap } from "@/lib/api";
import type { MapArtifact } from "@/lib/types";
import { MapView } from "@/components/map/map-view";
import { BackendNotice } from "@/components/backend-notice";

export default function MapPage() {
  const [artifact, setArtifact] = useState<MapArtifact | null>(null);
  const [error, setError] = useState(false);
  const [focusArxiv, setFocusArxiv] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    getMap().then(setArtifact).catch(() => setError(true));
    // Read ?ids=arxiv1,arxiv2 (set by Ask's "show sources on map") without useSearchParams,
    // so the page stays a simple static client component.
    const ids = new URLSearchParams(window.location.search).get("ids");
    if (ids) setFocusArxiv(ids.split(",").filter(Boolean));
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <BackendNotice />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2 font-mono text-sm text-mist">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the research landscape…
      </div>
    );
  }

  if (artifact.n_papers === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="kicker mb-2">The map of science</div>
          <h1 className="font-display text-2xl">The map is being drawn</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-mist">
            The corpus is being projected and clustered in the background — this takes a
            minute or two after a fresh start. Refresh shortly, or explore the other tabs
            meanwhile.
          </p>
        </div>
      </div>
    );
  }

  return <MapView artifact={artifact} focusArxiv={focusArxiv} />;
}
