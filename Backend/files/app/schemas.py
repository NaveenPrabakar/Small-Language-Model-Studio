"""
Pydantic schemas for request validation and response serialization.
Kept separate from the ORM models (app.models) so the API contract can
evolve independently of the storage schema.
"""
from datetime import datetime
from typing import Literal

from pydantic import AnyUrl, BaseModel, ConfigDict, Field


ModelBadge = Literal["Fast", "Balanced", "Powerful"]


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str = "Ollama"
    badge: ModelBadge
    parameter_size: str | None = None
    quantization: str | None = None
    size_bytes: int | None = None


class ModelListResponse(BaseModel):
    models: list[ModelInfo]


class ConversationCreate(BaseModel):
    model_id: str = Field(..., min_length=1)
    title: str | None = None


class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    model_id: str
    created_at: datetime
    updated_at: datetime


class ConversationUpdate(BaseModel):
    title: str | None = None
    model_id: str | None = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: Literal["user", "assistant"]
    content: str
    model_id: str | None = None
    created_at: datetime


class ChatRequest(BaseModel):
    content: str = Field(..., min_length=1)
    model_id: str | None = None


class ErrorResponse(BaseModel):
    detail: str


# ---------- Model pulls ----------


class ModelPullRequest(BaseModel):
    name: str = Field(..., min_length=1)


class ModelPullResponse(BaseModel):
    status: str
    model: str


# ---------- MCP servers ----------


class McpServerCreate(BaseModel):
    name: str = Field(..., min_length=1)
    url: AnyUrl


class McpServerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    url: str
    created_at: datetime
    updated_at: datetime


class McpServerListResponse(BaseModel):
    servers: list[McpServerSummary]


# ---------- Agent / skill presets ----------


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1)
    system_prompt: str = Field(..., min_length=1)


class AgentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    system_prompt: str
    created_at: datetime
    updated_at: datetime


class AgentListResponse(BaseModel):
    agents: list[AgentSummary]


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1)
    instructions: str = Field(..., min_length=1)


class SkillSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    instructions: str
    created_at: datetime
    updated_at: datetime


class SkillListResponse(BaseModel):
    skills: list[SkillSummary]
