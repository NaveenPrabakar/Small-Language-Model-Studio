from __future__ import annotations

import json
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from mcp.client.session import ClientSession
from mcp.client.sse import sse_client
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import McpServer
from contextlib import AsyncExitStack
from mcp.client.streamable_http import streamablehttp_client
import logging

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DiscoveredTool:
    server_id: str
    server_name: str
    server_url: str
    name: str
    description: str | None
    input_schema: dict | None


@asynccontextmanager
async def open_mcp_session(url: str) -> AsyncIterator[ClientSession]:
    async with AsyncExitStack() as stack:
        session = await _connect_sse(url, stack)
        if session is None:
            session = await _connect_streamable_http(url, stack)
        if session is None:
            raise ConnectionError(
                f"Could not connect to MCP server at {url} via SSE or streamable HTTP"
            )
        yield session

async def _connect_sse(url: str, stack: AsyncExitStack) -> ClientSession | None:
    try:
        streams = await stack.enter_async_context(sse_client(url))
        session = await stack.enter_async_context(ClientSession(*streams))
        await session.initialize()
        return session
    except Exception as exc:
        logger.debug("SSE transport failed for %s: %s", url, exc)
        return None


async def _connect_streamable_http(url: str, stack: AsyncExitStack) -> ClientSession | None:
    try:
        read, write, _ = await stack.enter_async_context(streamablehttp_client(url))
        session = await stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        return session
    except Exception as exc:
        logger.debug("Streamable HTTP transport failed for %s: %s", url, exc)
        return None


async def list_servers(db: AsyncSession) -> list[McpServer]:
    result = await db.execute(select(McpServer).order_by(McpServer.created_at.asc()))
    return list(result.scalars().all())


async def create_server(db: AsyncSession, *, name: str, url: str) -> McpServer:
    server = McpServer(name=name, url=str(url).rstrip("/"))
    db.add(server)
    await db.commit()
    await db.refresh(server)
    return server


async def delete_server(db: AsyncSession, server_id: str) -> None:
    await db.execute(delete(McpServer).where(McpServer.id == server_id))
    await db.commit()


async def list_server_tools(server: McpServer) -> list[DiscoveredTool]:
    async with open_mcp_session(server.url) as session:
        result = await session.list_tools()
        return [
            DiscoveredTool(
                server_id=server.id,
                server_name=server.name,
                server_url=server.url,
                name=tool.name,
                description=tool.description,
                input_schema=tool.inputSchema,
            )
            for tool in result.tools
        ]


async def call_server_tool(server: McpServer, tool_name: str, arguments: dict | None) -> str:
    async with open_mcp_session(server.url) as session:
        result = await session.call_tool(tool_name, arguments or {})
        if result.structuredContent is not None:
            return json.dumps(result.structuredContent, indent=2, default=str)

        parts: list[str] = []
        for block in result.content:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
            else:
                parts.append(json.dumps(block.model_dump(mode="json", exclude_none=True), default=str))
        if not parts:
            return "(empty tool result)"
        return "\n".join(parts)
