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
    // Read ?ids=arxiv1,arxiv2 (set by "Position → show on map") without useSearchParams,
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
          <h1 className="font-display text-2xl">No map built yet</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-mist">
            Ingest a corpus, then build the map:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-black/40 p-4 font-mono text-[12.5px] text-signal">
{`python -m veris.ingest "your topic" --max 200
python -m veris.buildmap`}
          </pre>
        </div>
      </div>
    );
  }

  return <MapView artifact={artifact} focusArxiv={focusArxiv} />;
}
