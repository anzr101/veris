"use client";

import { useEffect, useState } from "react";
import { getMap } from "@/lib/api";
import type { MapArtifact } from "@/lib/types";
import { AtlasView } from "@/components/atlas/atlas-view";

export default function AtlasPage() {
  const [artifact, setArtifact] = useState<MapArtifact | null>(null);
  const [focus, setFocus] = useState<string[] | undefined>();

  useEffect(() => {
    getMap().then(setArtifact).catch(() => {});
    // ?ids=a,b arrives from an answer's "Locate sources in atlas".
    const ids = new URLSearchParams(window.location.search).get("ids");
    if (ids) setFocus(ids.split(",").filter(Boolean));
  }, []);

  if (!artifact) {
    return (
      <div className="flex h-[calc(100svh-4rem)] items-center justify-center">
        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent" />
      </div>
    );
  }
  return <AtlasView artifact={artifact} focusArxiv={focus} />;
}
