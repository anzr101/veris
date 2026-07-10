import type { MapArtifact, Paper, Stats } from "./types";

// Calls are proxied through Next's /api rewrite to the FastAPI backend (see next.config.mjs),
// so the browser stays same-origin and there's no CORS dance.
const BASE = "/api";

export interface SSEvent {
  event: string;
  data: unknown;
}

/**
 * Stream a grounded answer. The backend endpoint is POST + Server-Sent Events, which the
 * native EventSource can't do — so we parse the SSE frames off the fetch body ourselves.
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
    throw new Error(`Ask failed (${res.status})`);
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

function parseFrame(frame: string): SSEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue; // keep-alive comment
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return { event, data: dataLines.join("\n") };
  }
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const getStats = () => getJSON<Stats>("/v1/stats");
export const getPapers = (limit = 30) => getJSON<Paper[]>(`/v1/papers?limit=${limit}`);
export const getMap = () => getJSON<MapArtifact>("/v1/map");
