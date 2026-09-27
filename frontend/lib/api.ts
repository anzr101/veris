import type { MapArtifact, Paper, Stats } from "./types";

// Calls go through Next's /api rewrite to the FastAPI backend (next.config.mjs), so the
// browser stays same-origin.
const BASE = "/api";

export interface SSEvent {
  event: string;
  data: unknown;
}

/**
 * Stream a grounded answer. The endpoint is POST + Server-Sent Events, which EventSource
 * can't do, so SSE frames are parsed off the fetch body directly.
 */
export async function askStream(
  question: string,
  onEvent: (ev: SSEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/v1/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!res.ok || !res.body) {
    let detail = "";
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? "";
    } catch {}
    throw new AskError(res.status, detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const parsed = parseFrame(frame);
      if (parsed) onEvent(parsed);
    }
  }
}

export class AskError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail || `Request failed (${status})`);
  }
}

function parseFrame(frame: string): SSEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}

/**
 * Read-only corpus endpoints fall back to a static snapshot of the same corpus
 * (public/snapshot) so browsing never breaks while the API is cold-starting.
 */
async function withSnapshot<T>(path: string, snapshot: string, timeoutMs = 8000): Promise<T> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${BASE}${path}`, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch {
    const res = await fetch(`/snapshot/${snapshot}`);
    return (await res.json()) as T;
  }
}

export const getStats = () => withSnapshot<Stats>("/v1/stats", "stats.json");

export async function getMap(): Promise<MapArtifact> {
  const live = await withSnapshot<MapArtifact>("/v1/map", "map.json");
  // A fresh boot rebuilds the map in the background; show the snapshot meanwhile.
  if (live.n_papers > 0) return live;
  const res = await fetch("/snapshot/map.json");
  return (await res.json()) as MapArtifact;
}

let papersCache: Promise<Paper[]> | null = null;

/** The whole corpus (a few hundred papers) — paged from the API, cached per session. */
export function getAllPapers(): Promise<Paper[]> {
  if (!papersCache) {
    papersCache = (async () => {
      try {
        const out: Paper[] = [];
        for (let offset = 0; offset < 5000; offset += 100) {
          const res = await fetch(`${BASE}/v1/papers?limit=100&offset=${offset}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error(String(res.status));
          const page = (await res.json()) as Paper[];
          out.push(...page);
          if (page.length < 100) break;
        }
        if (out.length === 0) throw new Error("empty");
        return out;
      } catch {
        const res = await fetch("/snapshot/papers.json");
        return (await res.json()) as Paper[];
      }
    })();
    papersCache.catch(() => (papersCache = null));
  }
  return papersCache;
}

export async function getPaper(arxivId: string): Promise<Paper | undefined> {
  const all = await getAllPapers();
  return all.find((p) => p.arxiv_id === arxivId);
}

export async function getHealth(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${BASE}/health`, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}
