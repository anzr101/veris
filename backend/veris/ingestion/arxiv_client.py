"""Async arXiv API client with robust Atom parsing.

The original n8n workflow indexed ``feed.entry[0..2]`` directly and broke whenever arXiv
returned a different number of results. This parser iterates whatever entries come back —
zero, three, or fifty — and tolerates missing fields.
"""

from __future__ import annotations

from datetime import datetime
from xml.etree import ElementTree as ET

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from veris.core.logging import get_logger
from veris.domain.models import Paper

_log = get_logger("veris.ingestion")

_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}


def _text(node: ET.Element | None) -> str:
    return (node.text or "").strip() if node is not None else ""


def _parse_dt(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _arxiv_id(raw_id: str) -> str:
    # e.g. "http://arxiv.org/abs/2401.01234v2" -> "2401.01234"
    tail = raw_id.rsplit("/abs/", 1)[-1]
    return tail.split("v")[0] if "v" in tail else tail


def _parse_entry(entry: ET.Element) -> Paper | None:
    title = " ".join(_text(entry.find("atom:title", _NS)).split())
    summary = " ".join(_text(entry.find("atom:summary", _NS)).split())
    if not title or not summary:
        return None

    raw_id = _text(entry.find("atom:id", _NS))
    authors = [
        _text(a.find("atom:name", _NS)) for a in entry.findall("atom:author", _NS)
    ]
    categories = [
        c.attrib["term"] for c in entry.findall("atom:category", _NS) if "term" in c.attrib
    ]
    pdf_url = next(
        (
            link.attrib.get("href")
            for link in entry.findall("atom:link", _NS)
            if link.attrib.get("title") == "pdf"
        ),
        None,
    )
    return Paper(
        arxiv_id=_arxiv_id(raw_id),
        title=title,
        abstract=summary,
        authors=[a for a in authors if a],
        categories=categories,
        published_at=_parse_dt(_text(entry.find("atom:published", _NS))),
        updated_at=_parse_dt(_text(entry.find("atom:updated", _NS))),
        pdf_url=pdf_url,
    )


def parse_feed(xml_text: str) -> list[Paper]:
    """Parse an arXiv Atom feed into papers, skipping malformed entries."""
    root = ET.fromstring(xml_text)
    papers: list[Paper] = []
    for entry in root.findall("atom:entry", _NS):
        paper = _parse_entry(entry)
        if paper is not None:
            papers.append(paper)
    return papers


class ArxivClient:
    def __init__(self, api_url: str, *, timeout: float = 30.0) -> None:
        self._api_url = api_url
        self._timeout = timeout

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def search(
        self,
        query: str,
        *,
        start: int = 0,
        max_results: int = 25,
        sort_by: str = "submittedDate",
        sort_order: str = "descending",
    ) -> list[Paper]:
        params = {
            "search_query": query,
            "start": start,
            "max_results": max_results,
            "sortBy": sort_by,
            "sortOrder": sort_order,
        }
        # arXiv 301-redirects http→https; follow it rather than erroring.
        async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
            resp = await client.get(self._api_url, params=params)
            resp.raise_for_status()
        papers = parse_feed(resp.text)
        _log.info("arxiv.search", query=query, returned=len(papers))
        return papers
