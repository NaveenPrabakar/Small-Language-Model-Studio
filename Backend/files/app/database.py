"""
Async SQLAlchemy engine and session management.

Uses SQLite via aiosqlite by default (zero external services required),
but any SQLAlchemy-async-compatible DATABASE_URL will work unmodified.
"""
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings

settings = get_settings()

# Ensure the sqlite file's parent directory exists before the engine touches it.
if settings.database_url.startswith("sqlite"):
    db_path = settings.database_url.split("///")[-1]
    parent_dir = os.path.dirname(db_path)
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)

engine = create_async_engine(settings.database_url, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


from . import models as _models  # noqa: E402,F401  # register ORM tables


async def init_db() -> None:
    """Create tables if they don't already exist. Called once on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields a request-scoped session."""
    async with AsyncSessionLocal() as session:
        yield session


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Context manager for use outside of request handlers (e.g. background tasks)."""
    async with AsyncSessionLocal() as session:
        yield session

