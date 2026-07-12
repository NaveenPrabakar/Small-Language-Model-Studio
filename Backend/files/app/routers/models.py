from fastapi import APIRouter, Depends, HTTPException

from ..ollama_client import OllamaClient, OllamaError, OllamaUnavailableError, get_ollama_client
from ..schemas import ModelListResponse, ModelPullRequest, ModelPullResponse
from ..services.model_service import build_model_list

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=ModelListResponse)
async def list_models(ollama: OllamaClient = Depends(get_ollama_client)) -> ModelListResponse:
    """
    Returns every model currently pulled in the local Ollama installation,
    formatted for the frontend's model picker (id/name/provider/badge).
    """
    try:
        raw_models = await ollama.list_models()
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return ModelListResponse(models=build_model_list(raw_models))


@router.post("/pull", response_model=ModelPullResponse)
async def pull_model(
    payload: ModelPullRequest, ollama: OllamaClient = Depends(get_ollama_client)
) -> ModelPullResponse:
    try:
        result = await ollama.pull_model(payload.name)
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    status = result.get("status") or "success"
    model = result.get("model") or payload.name
    return ModelPullResponse(status=status, model=model)
