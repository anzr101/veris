.PHONY: help install dev up down logs lint type test fmt

help:
	@echo "Veris — common tasks"
	@echo "  make install   Install backend deps (editable + dev)"
	@echo "  make dev       Run the API with autoreload"
	@echo "  make up        Start the full stack (db, api, web)"
	@echo "  make down      Stop the stack"
	@echo "  make lint      Ruff lint"
	@echo "  make type      Mypy type-check"
	@echo "  make test      Run the test suite"
	@echo "  make fmt       Ruff format"

install:
	cd backend && pip install -e ".[dev]"

dev:
	cd backend && uvicorn veris.main:app --reload --port 8000

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f api

lint:
	cd backend && ruff check .

fmt:
	cd backend && ruff format .

type:
	cd backend && mypy veris

test:
	cd backend && pytest -q
