from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas import McpServerCreate, McpServerListResponse, McpServerSummary
from ..services import mcp_service

router = APIRouter(prefix="/api/mcp-servers", tags=["mcp-servers"])


@router.get("", response_model=McpServerListResponse)
async def list_servers(db: AsyncSession = Depends(get_db)) -> McpServerListResponse:
    servers = await mcp_service.list_servers(db)
    return McpServerListResponse(
        servers=[
            McpServerSummary(
                id=server.id,
                name=server.name,
                url=server.url,
                created_at=server.created_at,
                updated_at=server.updated_at,
            )
            for server in servers
        ]
    )


@router.post("", response_model=McpServerSummary, status_code=201)
async def create_server(
    payload: McpServerCreate, db: AsyncSession = Depends(get_db)
) -> McpServerSummary:
    try:
        server = await mcp_service.create_server(db, name=payload.name, url=payload.url)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return McpServerSummary(
        id=server.id,
        name=server.name,
        url=server.url,
        created_at=server.created_at,
        updated_at=server.updated_at,
    )


@router.delete("/{server_id}", status_code=204)
async def delete_server(server_id: str, db: AsyncSession = Depends(get_db)) -> None:
    await mcp_service.delete_server(db, server_id)
