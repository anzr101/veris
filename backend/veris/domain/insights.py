"""Domain models for the Map of Science."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PaperVector(BaseModel):
    """A paper reduced to one vector (mean of its chunk embeddings) plus map metadata.

    Internal transport between the store and the map builder.
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


# A palette tuned to the dark "instrument" theme — distinct, legible on near-black.
CLUSTER_PALETTE = [
    "#3ee6c4", "#f5c46b", "#7aa2ff", "#f0707f", "#9d8cff",
    "#5fd0e6", "#e89bd0", "#8fd673", "#ffae6b", "#6be0a8",
    "#d98cff", "#e6d35f",
]
