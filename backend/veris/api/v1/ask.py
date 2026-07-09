"""Ask endpoints: streaming (SSE) and synchronous."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from veris.api.deps import get_services
from veris.api.schemas import AskRequest
from veris.api.security import ASK_LIMIT, limiter
from veris.api.state import Services
from veris.domain.answer import Answer
from veris.guardrails import screen_input
from veris.llm.errors import LLMUnavailableError

router = APIRouter()


@router.post("/ask")
@limiter.limit(ASK_LIMIT)
async def ask_stream(
    request: Request, req: AskRequest, services: Services = Depends(get_services)
) -> EventSourceResponse:
    """Stream the grounded answer as Server-Sent Events.

    Event types: ``plan``, ``citations``, ``token`` (many), ``verification``,
    ``contradictions``, ``done`` — or ``error`` if the LLM provider drops mid-stream
    (the response is already 200 by then, so the failure must travel as an event).
    """
    question = screen_input(req.question).text

    async def event_gen() -> AsyncIterator[dict[str, str]]:
        try:
            async for event in services.ask.ask_stream(question):
                yield {"event": event["type"], "data": json.dumps(event["data"])}
        except LLMUnavailableError as e:
            yield {
                "event": "error",
                "data": json.dumps({"detail": f"LLM provider unavailable: {e.detail}"}),
            }

    return EventSourceResponse(event_gen())


@router.post("/ask/sync", response_model=Answer)
@limiter.limit(ASK_LIMIT)
async def ask_sync(
    request: Request, req: AskRequest, services: Services = Depends(get_services)
) -> Answer:
    """Non-streaming variant — returns the fully assembled, verified answer."""
    return await services.ask.ask(screen_input(req.question).text)
