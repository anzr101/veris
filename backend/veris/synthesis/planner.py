"""Query planner — decomposes a question into sub-queries (cheap UTILITY-tier call)."""

from __future__ import annotations

import json

from veris.domain.answer import QueryPlan
from veris.llm.router import LLMRouter
from veris.llm.types import ModelTier
from veris.synthesis.prompts import PLANNER_SYSTEM, build_planner_prompt

_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "sub_queries": {"type": "array", "items": {"type": "string"}},
        "intent": {"type": "string", "enum": ["lookup", "synthesis", "comparison"]},
    },
    "required": ["sub_queries", "intent"],
    "additionalProperties": False,
}


class QueryPlanner:
    def __init__(self, router: LLMRouter) -> None:
        self._router = router

    async def plan(self, question: str) -> QueryPlan:
        result = await self._router.complete(
            ModelTier.UTILITY,
            prompt=build_planner_prompt(question),
            system=PLANNER_SYSTEM,
            stage="plan",
            max_tokens=512,
            json_schema=_PLAN_SCHEMA,
        )
        try:
            data = json.loads(result.text)
            sub_queries = [q for q in data.get("sub_queries", []) if q.strip()]
            intent = data.get("intent", "synthesis")
        except (json.JSONDecodeError, AttributeError):
            sub_queries, intent = [], "synthesis"
        # Always fall back to the raw question so retrieval never runs empty.
        if not sub_queries:
            sub_queries = [question]
        return QueryPlan(sub_queries=sub_queries, intent=intent)
