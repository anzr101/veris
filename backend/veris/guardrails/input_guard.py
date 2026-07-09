"""Input guardrail: sanitize user text and block prompt-injection attempts.

Runs before any LLM call. Deliberately a small, auditable pattern list rather than a
classifier — every block is explainable ("matched pattern X"), which matters more here
than recall: the downstream synthesis prompt already instructs the model to only answer
from the provided passages, so this layer only needs to catch the blatant attempts to
rewrite that contract.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Each entry: (compiled pattern, human-readable reason).
_INJECTION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"\b(ignore|disregard|forget)\b.{0,40}\b(instruction|prompt|rule)s?", re.I),
        "attempts to override instructions",
    ),
    (
        re.compile(r"\b(system|developer)\s+prompt\b", re.I),
        "references the system prompt",
    ),
    (
        re.compile(r"\b(reveal|show|print|repeat)\b.{0,40}\b(instructions|prompt|rules)\b", re.I),
        "asks to exfiltrate instructions",
    ),
    (
        re.compile(r"\byou\s+are\s+now\b|\bact\s+as\s+(an?\s+)?(unrestricted|jailbroken)", re.I),
        "attempts a persona override",
    ),
    (
        re.compile(r"\bdan\s+mode\b|\bjailbreak\b", re.I),
        "known jailbreak phrasing",
    ),
    (
        re.compile(r"<\s*/?\s*(system|assistant|instructions?)\s*>", re.I),
        "injects fake role/markup tags",
    ),
]

# C0/C1 control characters except \n and \t — used to smuggle invisible instructions.
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


class GuardrailViolation(ValueError):
    """Raised when user input fails the guardrail screen."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


@dataclass(frozen=True)
class ScreenedInput:
    text: str  # sanitized text, safe to interpolate into prompts


def screen_input(text: str) -> ScreenedInput:
    """Sanitize ``text`` and raise :class:`GuardrailViolation` on injection patterns."""
    cleaned = _CONTROL_CHARS.sub("", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    for pattern, reason in _INJECTION_PATTERNS:
        if pattern.search(cleaned):
            raise GuardrailViolation(f"Input rejected by guardrail: {reason}.")
    return ScreenedInput(text=cleaned)
