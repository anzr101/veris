"""API security: per-client rate limiting and standard security headers.

Rate limits are per-IP token buckets (slowapi, in-memory — one process, free tier).
The LLM-backed endpoints get tight limits because each request costs real provider
quota; read-only endpoints share a generous default. Behind Render/Vercel the socket
peer is the proxy, so the client key comes from the first ``X-Forwarded-For`` hop.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from slowapi import Limiter

# Per-route limits, referenced by the endpoint decorators.
ASK_LIMIT = "10/minute"
POSITION_LIMIT = "6/minute"
INGEST_LIMIT = "3/minute"


def client_ip(request: Request) -> str:
    """Real client IP: first X-Forwarded-For hop (set by the platform proxy), else peer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=client_ip, default_limits=["120/minute"])


async def security_headers_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Attach standard hardening headers to every response."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", response.headers.get("Cache-Control", "no-store"))
    return response
