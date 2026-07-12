"""
Turns the raw output of Ollama's /api/tags into the ModelInfo shape the
frontend's model picker expects (id/name/provider/badge).

Badge is a heuristic based on parameter count, which is how the frontend
communicates "how heavy is this model" without needing raw byte sizes:
  <= 3B params   -> "Fast"       (phi3-mini, qwen2.5:1.5b, llama3.2:1b/3b ...)
  3B - 13B       -> "Balanced"   (llama3.1:8b, mistral:7b, gemma2:9b ...)
  > 13B          -> "Powerful"   (llama3.1:70b, mixtral:8x7b ...)
"""
from __future__ import annotations

import re

from ..schemas import ModelBadge, ModelInfo

_PARAM_SIZE_RE = re.compile(r"([\d.]+)\s*([BM])", re.IGNORECASE)


def _parse_param_count_in_billions(parameter_size: str | None) -> float | None:
    """'3.2B' -> 3.2, '540M' -> 0.54, None/unparseable -> None."""
    if not parameter_size:
        return None
    match = _PARAM_SIZE_RE.search(parameter_size)
    if not match:
        return None
    value, unit = float(match.group(1)), match.group(2).upper()
    return value if unit == "B" else value / 1000.0


def _badge_for(param_billions: float | None) -> ModelBadge:
    if param_billions is None:
        return "Balanced"
    if param_billions <= 3:
        return "Fast"
    if param_billions <= 13:
        return "Balanced"
    return "Powerful"


def _display_name(tag: str, family: str | None, parameter_size: str | None) -> str:
    base = tag.split(":")[0]
    pretty_base = base.replace("-", " ").replace("_", " ")
    pretty_base = " ".join(part.capitalize() for part in pretty_base.split())
    if parameter_size and parameter_size.lower() not in pretty_base.lower():
        return f"{pretty_base} {parameter_size}"
    return pretty_base


def build_model_info(raw: dict) -> ModelInfo:
    """raw is one entry from Ollama's GET /api/tags `models` array."""
    tag: str = raw["name"]
    details = raw.get("details", {}) or {}
    parameter_size = details.get("parameter_size")
    quantization = details.get("quantization_level")
    family = details.get("family")

    param_billions = _parse_param_count_in_billions(parameter_size)

    return ModelInfo(
        id=tag,
        name=_display_name(tag, family, parameter_size),
        provider="Ollama",
        badge=_badge_for(param_billions),
        parameter_size=parameter_size,
        quantization=quantization,
        size_bytes=raw.get("size"),
    )


def build_model_list(raw_models: list[dict]) -> list[ModelInfo]:
    models = [build_model_info(m) for m in raw_models]
    models.sort(key=lambda m: (m.badge != "Fast", m.badge != "Balanced", m.name))
    return models

