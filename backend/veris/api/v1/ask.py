"""Ask endpoints: streaming (SSE) and synchronous."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from veris.api.deps import get_services
from veris.api.schemas import AskRequest
from veris.api.state import Services
from veris.domain.answer import Answer

router = APIRouter()


@router.post("/ask")
async def ask_stream(req: AskRequest, services: Services = Depends(get_services)):
    """Stream the grounded answer as Server-Sent Events.

    Event types: ``plan``, ``citations``, ``token`` (many), ``verification``,
    ``contradictions``, ``done``.
    """

    async def event_gen():
        async for event in services.ask.ask_stream(req.question):
            yield {"event": event["type"], "data": json.dumps(event["data"])}

    return EventSourceResponse(event_gen())


@router.post("/ask/sync", response_model=Answer)
async def ask_sync(req: AskRequest, services: Services = Depends(get_services)) -> Answer:
    """Non-streaming variant — returns the fully assembled, verified answer."""
    return await services.ask.ask(req.question)
