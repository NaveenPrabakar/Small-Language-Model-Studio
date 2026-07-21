"""
FastAPI application entrypoint.

Run with:
    uvicorn app.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .database import init_db
from .ollama_client import OllamaError
from .routers import chat, conversations, models, mcp_servers, presets
from .routers import chat, conversations, models, mcp_servers, presets, embeddings
from .routers import chat, conversations, models, mcp_servers, presets, embeddings, agent_workflows
from pathlib import Path
from fastapi.staticfiles import StaticFiles
import logging



logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)



@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="SLM Studio Backend (Ollama)", version="1.0.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(models.router)
app.include_router(mcp_servers.router)
app.include_router(presets.router)
app.include_router(conversations.router)
app.include_router(chat.router)
app.include_router(embeddings.router)
app.include_router(agent_workflows.router)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend_dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")





@app.exception_handler(OllamaError)
async def ollama_error_handler(request: Request, exc: OllamaError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}
