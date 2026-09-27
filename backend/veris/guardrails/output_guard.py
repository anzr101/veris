"""Output guardrail: deterministic checks on the synthesized answer.

- ``strip_unbacked_citations``: the synthesis prompt numbers evidence passages 1..N;
  any ``[k]`` marker outside that range points at evidence that does not exist, so it
  is removed rather than shown as a clickable-but-dead citation.
- ``grounded_share``: fraction of verified claims whose status is "supported" — the
  faithfulness number surfaced in the UI and gated in the eval harness.
"""

from __future__ import annotations

import re

from veris.domain.answer import ClaimVerification

_CITE_MARKER = re.compile(r"\[(\d{1,3})\]")
# Some open-weight models emit browsing-style markers: 【3†L4-L6】 or [3†source].
_ALT_MARKER = re.compile(r"[【\[](\d{1,3})†[^】\]]*[】\]]|【(\d{1,3})】")


def normalize_citations(markdown: str) -> str:
    """Rewrite alternative citation syntaxes to the canonical ``[n]`` form."""
    return _ALT_MARKER.sub(lambda m: f"[{m.group(1) or m.group(2)}]", markdown)


def strip_unbacked_citations(markdown: str, n_citations: int) -> str:
    """Remove citation markers that don't correspond to a retrieved passage."""

    def _keep_or_drop(m: re.Match[str]) -> str:
        idx = int(m.group(1))
        return m.group(0) if 1 <= idx <= n_citations else ""

    return _CITE_MARKER.sub(_keep_or_drop, normalize_citations(markdown))


def grounded_share(claims: list[ClaimVerification]) -> float:
    """Share of claims fully entailed by their cited evidence (1.0 when no claims)."""
    if not claims:
        return 1.0
    return sum(1 for c in claims if c.status == "supported") / len(claims)
