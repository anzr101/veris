"""Position-my-research endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from veris.api.deps import get_services
from veris.api.schemas import PositionRequest
from veris.api.security import POSITION_LIMIT, limiter
from veris.api.state import Services
from veris.domain.insights import PositionReport
from veris.guardrails import screen_input

router = APIRouter()


@router.post("/position", response_model=PositionReport)
@limiter.limit(POSITION_LIMIT)
async def position(
    request: Request, req: PositionRequest, services: Services = Depends(get_services)
) -> PositionReport:
    """Place a research idea/abstract in the literature: novelty, nearest work, adjacent
    authors (public data only), gaps, and a grounded related-work draft."""
    return await services.position.position(screen_input(req.text).text)
