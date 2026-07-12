"""
Thin wrapper around Ollama's native REST API (http://localhost:11434).

Deliberately uses Ollama's own /api/tags and /api/chat endpoints (rather
than its OpenAI-compatibility layer) because /api/chat's streaming
response includes fine-grained token deltas and per-request timing/eval
stats that are useful for a "local SLM" oriented UI.

Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
"""
from __future__ import annotations

import json
from typing import AsyncIterator, Iterable

import httpx

from .config import get_settings


class OllamaError(Exception):
    """Raised for any failure talking to Ollama (unreachable, bad model, etc.)."""


class OllamaUnavailableError(OllamaError):
    """Raised specifically when the Ollama server cannot be reached at all."""


class OllamaClient:
    def __init__(self, base_url: str | None = None, timeout: float | None = None):
        settings = get_settings()
        self._base_url = (base_url or settings.ollama_host).rstrip("/")
        self._timeout = timeout or settings.ollama_timeout_seconds

    async def list_models(self) -> list[dict]:
        """Return the raw list of model dicts from GET /api/tags."""
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                resp.raise_for_status()
        except httpx.ConnectError as exc:
            raise OllamaUnavailableError(
                f"Could not reach Ollama at {self._base_url}. Is `ollama serve` running?"
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise OllamaError(f"Ollama returned {exc.response.status_code} for /api/tags") from exc

        return resp.json().get("models", [])

    async def pull_model(self, model: str) -> dict:
        """Pull a model from Ollama's library and wait for completion."""
        payload = {"model": model, "stream": False}
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                response = await client.post(f"{self._base_url}/api/pull", json=payload)
                response.raise_for_status()
        except httpx.ConnectError as exc:
            raise OllamaUnavailableError(
                f"Could not reach Ollama at {self._base_url}. Is `ollama serve` running?"
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise OllamaError(f"Ollama returned {exc.response.status_code} for /api/pull") from exc

        return response.json()

    async def chat_once(self, model: str, messages: Iterable[dict]) -> str:
        """Return one non-streaming assistant response from POST /api/chat."""
        payload = {
            "model": model,
            "messages": list(messages),
            "stream": False,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(f"{self._base_url}/api/chat", json=payload)
                response.raise_for_status()
        except httpx.ConnectError as exc:
            raise OllamaUnavailableError(
                f"Could not reach Ollama at {self._base_url}. Is `ollama serve` running?"
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise OllamaError(f"Ollama returned {exc.response.status_code} for /api/chat") from exc

        data = response.json()
        message = data.get("message") or {}
        return message.get("content") or data.get("response") or ""

    async def stream_chat(
        self, model: str, messages: Iterable[dict]
    ) -> AsyncIterator[dict]:
        """
        Stream a chat completion from POST /api/chat.

        Yields the raw decoded JSON object for each line Ollama sends, e.g.:
          {"message": {"role": "assistant", "content": "Hel"}, "done": false}
          ...
          {"message": {...}, "done": true, "eval_count": 42, "eval_duration": ...}
        """
        payload = {
            "model": model,
            "messages": list(messages),
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                async with client.stream(
                    "POST", f"{self._base_url}/api/chat", json=payload
                ) as response:
                    if response.status_code == 404:
                        raise OllamaError(
                            f"Model '{model}' not found locally. Pull it first with "
                            f"`ollama pull {model}`."
                        )
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        yield json.loads(line)
        except httpx.ConnectError as exc:
            raise OllamaUnavailableError(
                f"Could not reach Ollama at {self._base_url}. Is `ollama serve` running?"
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise OllamaError(
                f"Ollama returned {exc.response.status_code} for /api/chat"
            ) from exc


def get_ollama_client() -> OllamaClient:
    """FastAPI dependency factory."""
    return OllamaClient()
