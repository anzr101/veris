import { TriangleAlert } from "lucide-react";

export function BackendNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber/25 bg-amber/[0.05] p-5">
      <TriangleAlert className="mt-0.5 h-5 w-5 flex-none text-amber" />
      <div className="text-[14px] leading-relaxed text-bone/90">
        <p className="font-medium">Backend not reachable.</p>
        <p className="mt-1 text-mist">
          Start the API with{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-signal">
            make up
          </code>{" "}
          or{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-signal">
            uvicorn veris.main:app
          </code>
          , then ingest a corpus with{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-signal">
            python -m veris.ingest
          </code>
          .
        </p>
      </div>
    </div>
  );
}
