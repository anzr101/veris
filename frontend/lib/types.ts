export interface Citation {
  index: number;
  chunk_id: number;
  arxiv_id: string;
  paper_title: string;
  section: string;
  snippet: string;
  url: string;
}

export interface ClaimVerification {
  claim: string;
  citation_indices: number[];
  status: "supported" | "partial" | "unsupported";
  confidence: number;
  rationale: string;
}

export interface Contradiction {
  topic: string;
  summary: string;
  arxiv_ids: string[];
}

export interface QueryPlan {
  sub_queries: string[];
  intent: string;
  categories?: string[] | null;
}

export interface Paper {
  arxiv_id: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  published_at?: string | null;
  pdf_url?: string | null;
}

export interface Stats {
  papers: number;
  chunks: number;
  embedding_model: string;
  synthesis_model: string;
  utility_model: string;
}

export interface MapNode {
  paper_id: number;
  arxiv_id: string;
  title: string;
  x: number;
  y: number;
  cluster: number;
  year: number | null;
  categories: string[];
}

export interface Cluster {
  id: number;
  label: string;
  description: string;
  size: number;
  color: string;
  x: number;
  y: number;
}

export interface MapEdge {
  source: number;
  target: number;
  weight: number;
  kind: string;
}

export interface MapArtifact {
  built_at: string | null;
  embedding_model?: string;
  n_papers: number;
  nodes: MapNode[];
  clusters: Cluster[];
  edges: MapEdge[];
  note?: string;
}

export type AskStage = "idle" | "planning" | "retrieving" | "synthesizing" | "verifying" | "done";

export interface AskState {
  stage: AskStage;
  plan?: QueryPlan;
  citations: Citation[];
  answer: string;
  claims: ClaimVerification[];
  faithfulness?: number;
  contradictions: Contradiction[];
  cost_usd?: number;
  latency_ms?: number;
  model?: string;
  error?: string;
}
