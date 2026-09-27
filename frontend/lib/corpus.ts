import type { Cluster, MapArtifact, Paper } from "./types";

export interface Topic extends Cluster {
  paperIds: string[];
}

/** Topics with the arXiv ids of their member papers, largest first. */
export function topicsFrom(map: MapArtifact): Topic[] {
  const members = new Map<number, string[]>();
  for (const n of map.nodes) {
    const list = members.get(n.cluster) ?? [];
    list.push(n.arxiv_id);
    members.set(n.cluster, list);
  }
  return map.clusters
    .map((c) => ({ ...c, paperIds: members.get(c.id) ?? [] }))
    .sort((a, b) => b.size - a.size);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function byNewest(papers: Paper[]): Paper[] {
  return [...papers].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
}

export function askAbout(title: string): string {
  return `/ask?q=${encodeURIComponent(`What does the paper "${title}" contribute, and how does it compare to related work?`)}`;
}
