"""
Centralized, typed application configuration.

All environment-dependent values live here so the rest of the codebase
never reads os.environ directly. See .env.example for the full list of
supported variables.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os
import sys
from pathlib import Path




def _default_database_url() -> str:
    if getattr(sys, "frozen", False):  # running as a PyInstaller exe
        data_dir = Path(os.environ["APPDATA"]) / "SLMStudio"
        data_dir.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{data_dir / 'app.db'}"
    return "sqlite+aiosqlite:///./data/app.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = Field(default_factory=_default_database_url)

    ollama_host: str = "http://localhost:11434"
    database_url: str = "sqlite+aiosqlite:///./data/app.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    max_context_messages: int = 20
    ollama_timeout_seconds: float = 120.0
    embedding_chunk_size: int = 1000
    embedding_chunk_overlap: int = 150
    embedding_top_k: int = 5

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Settings are read once and cached; env changes require a process restart."""
    return Settings()

