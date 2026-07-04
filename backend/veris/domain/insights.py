"""Domain models for the Map of Science and the Position-my-research copilot."""

from __future__ import annotations

from pydantic import BaseModel, Field

from veris.domain.answer import Citation, ClaimVerification


class PaperVector(BaseModel):
    """A paper reduced to one vector (mean of its chunk embeddings) plus map metadata.

    Internal transport between the store and the map/position services.
    """

    paper_id: int
    arxiv_id: str
    title: str
    categories: list[str] = Field(default_factory=list)
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    vector: list[float]


class MapNode(BaseModel):
    paper_id: int
    arxiv_id: str
    title: str
    x: float
    y: float
    cluster: int
    year: int | None = None
    categories: list[str] = Field(default_factory=list)


class Cluster(BaseModel):
    id: int
    label: str
    description: str = ""
    size: int = 0
    color: str = "#3ee6c4"
    x: float = 0.0
    y: float = 0.0


class MapEdge(BaseModel):
    source: int  # node index
    target: int  # node index
    weight: float = 1.0
    kind: str = "semantic"


class MapArtifact(BaseModel):
    built_at: str
    embedding_model: str = ""
    n_papers: int = 0
    nodes: list[MapNode] = Field(default_factory=list)
    clusters: list[Cluster] = Field(default_factory=list)
    edges: list[MapEdge] = Field(default_factory=list)


class PaperRef(BaseModel):
    arxiv_id: str
    title: str


class ScoredPaper(BaseModel):
    arxiv_id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    year: int | None = None
    score: float = 0.0
    url: str = ""


class Collaborator(BaseModel):
    """A potential collaborator surfaced from PUBLIC author metadata only — no contact info."""

    name: str
    affiliation: str | None = None
    paper_count: int = 0
    sample_papers: list[PaperRef] = Field(default_factory=list)
    profile_url: str = ""


class PositionReport(BaseModel):
    """Where a research idea sits in the literature."""

    input: str
    novelty_score: float = 0.0  # 1 = open frontier, 0 = crowded
    density: float = 0.0  # mean similarity of nearest work
    crowded_count: int = 0  # how many close neighbors
    nearest: list[ScoredPaper] = Field(default_factory=list)
    collaborators: list[Collaborator] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    related_work_markdown: str = ""
    citations: list[Citation] = Field(default_factory=list)
    claims: list[ClaimVerification] = Field(default_factory=list)
    model: str = ""
    cost_usd: float = 0.0
    latency_ms: float = 0.0


# A palette tuned to the dark "instrument" theme — distinct, legible on near-black.
CLUSTER_PALETTE = [
    "#3ee6c4", "#f5c46b", "#7aa2ff", "#f0707f", "#9d8cff",
    "#5fd0e6", "#e89bd0", "#8fd673", "#ffae6b", "#6be0a8",
    "#d98cff", "#e6d35f",
]
