"use client";

import { useEffect, useState } from "react";
import { getMap } from "@/lib/api";
import type { MapArtifact } from "@/lib/types";
import { AtlasView } from "@/components/atlas/atlas-view";

export default function AtlasPage() {
  const [artifact, setArtifact] = useState<MapArtifact | null>(null);
  const [focus, setFocus] = useState<string[] | undefined>();
  const [topic, setTopic] = useState<number | null>(null);

  useEffect(() => {
    getMap().then(setArtifact).catch(() => {});
    // ?ids=a,b arrives from an answer's "Locate sources in atlas"; ?topic=n from Topics.
    const params = new URLSearchParams(window.location.search);
    const ids = params.get("ids");
    if (ids) setFocus(ids.split(",").filter(Boolean));
    const t = params.get("topic");
    if (t !== null && !Number.isNaN(Number(t))) setTopic(Number(t));
  }, []);

  if (!artifact) {
    return (
      <div className="grid-navy flex h-[calc(100svh-4rem)] items-center justify-center bg-navy-deep">
        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-blue-bright" />
      </div>
    );
  }
  return <AtlasView artifact={artifact} focusArxiv={focus} initialTopic={topic} />;
}
