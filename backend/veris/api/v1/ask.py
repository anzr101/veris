"""Ask endpoints: streaming (SSE) and synchronous."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from veris.api.deps import get_services
from veris.api.schemas import AskRequest
from veris.api.state import Services
from veris.domain.answer import Answer
from veris.llm.errors import LLMUnavailableError

router = APIRouter()


@router.post("/ask")
async def ask_stream(req: AskRequest, services: Services = Depends(get_services)):
    """Stream the grounded answer as Server-Sent Events.

    Event types: ``plan``, ``citations``, ``token`` (many), ``verification``,
    ``contradictions``, ``done`` — or ``error`` if the LLM provider drops mid-stream
    (the response is already 200 by then, so the failure must travel as an event).
    """

    async def event_gen():
        try:
            async for event in services.ask.ask_stream(req.question):
                yield {"event": event["type"], "data": json.dumps(event["data"])}
        except LLMUnavailableError as e:
            yield {
                "event": "error",
                "data": json.dumps({"detail": f"LLM provider unavailable: {e.detail}"}),
            }

    return EventSourceResponse(event_gen())


@router.post("/ask/sync", response_model=Answer)
async def ask_sync(req: AskRequest, services: Services = Depends(get_services)) -> Answer:
    """Non-streaming variant — returns the fully assembled, verified answer."""
    return await services.ask.ask(req.question)
