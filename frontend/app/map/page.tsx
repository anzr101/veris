"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getMap } from "@/lib/api";
import type { MapArtifact } from "@/lib/types";
import { MapView } from "@/components/map/map-view";
import { BackendNotice } from "@/components/backend-notice";

const POLL_MS = 10_000;

export default function MapPage() {
  const [artifact, setArtifact] = useState<MapArtifact | null>(null);
  const [error, setError] = useState(false);
  const [focusArxiv, setFocusArxiv] = useState<string[] | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () =>
      getMap()
        .then((a) => {
          setArtifact(a);
          setError(false);
          // The map builds in the background after a fresh boot — poll until it lands.
          if (a.n_papers > 0 && timer.current) {
            clearInterval(timer.current);
            timer.current = null;
          }
        })
        .catch(() => setError(true));

    load();
    timer.current = setInterval(load, POLL_MS);

    // Read ?ids=arxiv1,arxiv2 (set by Ask's "show sources on map") without useSearchParams,
    // so the page stays a simple static client component.
    const ids = new URLSearchParams(window.location.search).get("ids");
    if (ids) setFocusArxiv(ids.split(",").filter(Boolean));

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <BackendNotice />
      </div>
    );
  }

  if (!artifact || artifact.n_papers === 0) {
    return (
      <Radar
        title={artifact ? "The map is being drawn" : "Loading the research landscape"}
        detail={
          artifact
            ? "The corpus is being projected and clustered in the background — usually a minute or two after a fresh start. This page refreshes itself."
            : "Fetching the atlas…"
        }
      />
    );
  }

  return <MapView artifact={artifact} focusArxiv={focusArxiv} />;
}

/** Radar-sweep loading state — concentric pulses, like a survey instrument warming up. */
function Radar({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-10 h-28 w-28">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border border-signal/40 motion-reduce:hidden"
            initial={{ scale: 0.25, opacity: 0.7 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
          />
        ))}
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal shadow-[0_0_12px_#D8B26A]" />
      </div>
      <h1 className="font-display text-2xl text-bone-bright">{title}</h1>
      <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-mist">{detail}</p>
    </div>
  );
}
