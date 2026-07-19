"""
Ingestion + retrieval for local, file-backed embedding collections.

Vectors are stored as JSON text in SQLite and compared with cosine
similarity in Python at query time. This is intentionally simple: fine for
a local, single-user tool at up to a few thousand chunks per collection,
but it is an O(n) scan per query with no ANN index. See module docstring
in the router / SKILL notes for scaling options if that stops being true.
"""
from __future__ import annotations

import io
import json
import math
import re
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import EmbeddingChunk, EmbeddingCollection
from ..ollama_client import OllamaClient

# Ollama's /api/tags doesn't expose a task/category field, so "is this an
# embedding model" is best-effort name/family matching for the settings UI.
# Any pulled model can still be passed explicitly to /embed even if it
# isn't surfaced by this heuristic.
_EMBEDDING_NAME_HINTS = ("embed", "bge-", "gte-", "minilm", "e5-", "arctic-embed")
_EMBEDDING_FAMILY_HINTS = ("bert", "nomic-bert")

_EMBED_BATCH_SIZE = 32


class EmbeddingIngestError(ValueError):
    """User-correctable ingestion failure (bad file, empty text, dup name, ...)."""


def looks_like_embedding_model(tag: str, family: str | None) -> bool:
    lowered = tag.lower()
    if any(hint in lowered for hint in _EMBEDDING_NAME_HINTS):
        return True
    if family and family.lower() in _EMBEDDING_FAMILY_HINTS:
        return True
    return False


def extract_text(filename: str, raw: bytes) -> str:
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if suffix == "pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise EmbeddingIngestError(
                "PDF support requires the 'pypdf' package (`pip install pypdf`)."
            ) from exc
        reader = PdfReader(io.BytesIO(raw))
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    elif suffix == "json":
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise EmbeddingIngestError(f"Could not parse '{filename}' as JSON.") from exc
        text = json.dumps(parsed, indent=2, ensure_ascii=False)
    else:
        # txt, md, csv, and anything else: best-effort UTF-8 text.
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise EmbeddingIngestError(
                f"Could not read '{filename}' as text. Supported types: pdf, json, txt, md, csv."
            ) from exc

    text = text.strip()
    if not text:
        raise EmbeddingIngestError(f"No extractable text found in '{filename}'.")
    return text


def chunk_text(text: str, *, chunk_size: int, overlap: int) -> list[str]:
    normalized = re.sub(r"\r\n?", "\n", text)
    paragraphs = [p.strip() for p in normalized.split("\n\n") if p.strip()] or [normalized]

    chunks: list[str] = []
    buffer = ""
    for paragraph in paragraphs:
        candidate = f"{buffer}\n\n{paragraph}" if buffer else paragraph
        if len(candidate) <= chunk_size:
            buffer = candidate
            continue

        if buffer:
            chunks.append(buffer)
        if len(paragraph) <= chunk_size:
            buffer = paragraph
        else:
            # A single paragraph exceeds chunk_size; hard-split with overlap.
            start = 0
            while start < len(paragraph):
                end = start + chunk_size
                chunks.append(paragraph[start:end])
                start = end - overlap if end - overlap > start else end
            buffer = ""

    if buffer:
        chunks.append(buffer)
    return chunks


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def _embed_texts(ollama: OllamaClient, model: str, texts: list[str]) -> list[list[float]]:
    vectors: list[list[float]] = []
    for start in range(0, len(texts), _EMBED_BATCH_SIZE):
        batch = texts[start : start + _EMBED_BATCH_SIZE]
        vectors.extend(await ollama.embed(model, batch))
    return vectors


async def list_collections(db: AsyncSession) -> list[EmbeddingCollection]:
    result = await db.execute(select(EmbeddingCollection).order_by(EmbeddingCollection.created_at.desc()))
    return list(result.scalars().all())


async def get_collection_by_name(db: AsyncSession, name: str) -> EmbeddingCollection | None:
    result = await db.execute(select(EmbeddingCollection).where(EmbeddingCollection.name == name))
    return result.scalar_one_or_none()


async def delete_collection(db: AsyncSession, collection_id: str) -> None:
    await db.execute(delete(EmbeddingCollection).where(EmbeddingCollection.id == collection_id))
    await db.commit()


async def create_collection(
    db: AsyncSession,
    ollama: OllamaClient,
    *,
    name: str,
    model_id: str,
    filename: str,
    raw: bytes,
) -> EmbeddingCollection:
    if not name:
        raise EmbeddingIngestError("Collection name is required.")
    if await get_collection_by_name(db, name) is not None:
        raise EmbeddingIngestError(f"An embedding collection named '{name}' already exists.")

    settings = get_settings()
    text = extract_text(filename, raw)
    pieces = chunk_text(
        text, chunk_size=settings.embedding_chunk_size, overlap=settings.embedding_chunk_overlap
    )
    if not pieces:
        raise EmbeddingIngestError(f"No chunks could be produced from '{filename}'.")

    vectors = await _embed_texts(ollama, model_id, pieces)
    if len(vectors) != len(pieces):
        raise EmbeddingIngestError("Embedding model returned a mismatched number of vectors.")

    collection = EmbeddingCollection(
        name=name, model_id=model_id, source_filename=filename, chunk_count=len(pieces)
    )
    db.add(collection)
    await db.flush()

    for index, (piece, vector) in enumerate(zip(pieces, vectors)):
        db.add(
            EmbeddingChunk(
                collection_id=collection.id,
                chunk_index=index,
                content=piece,
                vector=json.dumps(vector),
            )
        )

    await db.commit()
    await db.refresh(collection)
    return collection


@dataclass(frozen=True)
class RetrievedChunk:
    content: str
    chunk_index: int
    score: float


async def query_collection(
    db: AsyncSession,
    ollama: OllamaClient,
    *,
    collection: EmbeddingCollection,
    query: str,
    top_k: int | None = None,
) -> list[RetrievedChunk]:
    settings = get_settings()
    top_k = top_k or settings.embedding_top_k

    result = await db.execute(
        select(EmbeddingChunk)
        .where(EmbeddingChunk.collection_id == collection.id)
        .order_by(EmbeddingChunk.chunk_index)
    )
    chunks = list(result.scalars().all())
    if not chunks:
        return []

    [query_vector] = await _embed_texts(ollama, collection.model_id, [query])

    scored = [
        RetrievedChunk(
            content=chunk.content,
            chunk_index=chunk.chunk_index,
            score=_cosine_similarity(query_vector, json.loads(chunk.vector)),
        )
        for chunk in chunks
    ]
    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:top_k]