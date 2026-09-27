// Questions asked in this browser, with their measured outcome. Kept in localStorage —
// a per-viewer convenience, never relied on for anything else.

export interface Run {
  question: string;
  at: number;
  faithfulness?: number;
  claims?: number;
  sources?: number;
  latency_ms?: number;
}

const KEY = "veris.runs.v1";
const MAX = 30;

export function loadRuns(): Run[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Run[]) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: Run): Run[] {
  const next = [run, ...loadRuns().filter((r) => r.question !== run.question)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function clearRuns(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
