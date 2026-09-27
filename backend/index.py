"""Serverless entrypoint (Vercel's FastAPI runtime looks for ``app`` here)."""

from veris.main import app

__all__ = ["app"]
