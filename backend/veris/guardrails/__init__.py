"""Guardrails — deterministic input/output checks around the LLM pipeline.

Two layers, both cheap and explainable:

- **Input guard** (``input_guard``): sanitizes user text and blocks obvious
  prompt-injection attempts *before* anything reaches a model.
- **Output guard** (``output_guard``): strips citation markers that don't map to a
  retrieved passage (a hallucinated ``[7]`` when only 5 sources exist) and computes
  the grounded-claim share used as the faithfulness score.

The LLM-based claim verification in ``veris.grounding`` is the semantic layer on
top; these are the fast, deterministic rails under it.
"""

from veris.guardrails.input_guard import GuardrailViolation, screen_input
from veris.guardrails.output_guard import grounded_share, strip_unbacked_citations

__all__ = [
    "GuardrailViolation",
    "grounded_share",
    "screen_input",
    "strip_unbacked_citations",
]
