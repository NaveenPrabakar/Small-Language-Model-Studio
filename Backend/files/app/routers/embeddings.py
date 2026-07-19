from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..ollama_client import OllamaClient, OllamaError, OllamaUnavailableError, get_ollama_client
from ..schemas import (
    EmbeddingCollectionListResponse,
    EmbeddingCollectionSummary,
    EmbeddingModelInfo,
    EmbeddingModelListResponse,
    EmbeddingModelPullRequest,
    EmbeddingModelPullResponse,
)
from ..services import embedding_service
from ..services.embedding_service import EmbeddingIngestError

router = APIRouter(prefix="/api/embeddings", tags=["embeddings"])


@router.get("/models", response_model=EmbeddingModelListResponse)
async def list_embedding_models(
    ollama: OllamaClient = Depends(get_ollama_client),
) -> EmbeddingModelListResponse:
    try:
        raw_models = await ollama.list_models()
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    models = [
        EmbeddingModelInfo(
            id=raw["name"],
            name=raw["name"],
            parameter_size=(raw.get("details") or {}).get("parameter_size"),
            size_bytes=raw.get("size"),
        )
        for raw in raw_models
        if embedding_service.looks_like_embedding_model(
            raw["name"], (raw.get("details") or {}).get("family")
        )
    ]
    return EmbeddingModelListResponse(models=models)


@router.post("/models/pull", response_model=EmbeddingModelPullResponse)
async def pull_embedding_model(
    payload: EmbeddingModelPullRequest, ollama: OllamaClient = Depends(get_ollama_client)
) -> EmbeddingModelPullResponse:
    try:
        result = await ollama.pull_model(payload.name)
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return EmbeddingModelPullResponse(
        status=result.get("status") or "success", model=result.get("model") or payload.name
    )


@router.get("/collections", response_model=EmbeddingCollectionListResponse)
async def list_collections(db: AsyncSession = Depends(get_db)) -> EmbeddingCollectionListResponse:
    collections = await embedding_service.list_collections(db)
    return EmbeddingCollectionListResponse(
        collections=[EmbeddingCollectionSummary.model_validate(c) for c in collections]
    )


@router.post("/collections", response_model=EmbeddingCollectionSummary, status_code=201)
async def create_collection(
    name: str = Form(...),
    model_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    ollama: OllamaClient = Depends(get_ollama_client),
) -> EmbeddingCollectionSummary:
    raw = await file.read()
    try:
        collection = await embedding_service.create_collection(
            db,
            ollama,
            name=name.strip(),
            model_id=model_id,
            filename=file.filename or "upload",
            raw=raw,
        )
    except EmbeddingIngestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return EmbeddingCollectionSummary.model_validate(collection)


@router.delete("/collections/{collection_id}", status_code=204)
async def delete_collection(collection_id: str, db: AsyncSession = Depends(get_db)) -> None:
    await embedding_service.delete_collection(db, collection_id)