# syntax=docker/dockerfile:1
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps kept minimal; fastembed ships ONNX runtime wheels.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer caching.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY veris ./veris

# Pre-embedded starter corpus (papers + chunks + vectors + FTS). Free-tier disks are
# ephemeral and arXiv rate-limits shared egress IPs, so booting from a bundled corpus
# beats re-ingesting on every cold start; live ingestion can still add to it.
COPY seed_corpus.db ./veris.db

# Non-root runtime user.
RUN useradd --create-home --uid 10001 veris && chown -R veris:veris /app
USER veris

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "veris.main:app", "--host", "0.0.0.0", "--port", "8000"]
