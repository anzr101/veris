"""FastAPI dependencies that expose the shared Services container to handlers."""

from __future__ import annotations

from fastapi import Request

from veris.api.state import Services


def get_services(request: Request) -> Services:
    return request.app.state.services
