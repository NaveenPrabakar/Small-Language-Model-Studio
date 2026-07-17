from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas import (
    AgentWorkflowCreate,
    AgentWorkflowListResponse,
    AgentWorkflowSummary,
    AgentWorkflowUpdate,
)
from ..services import agent_workflow_service
from ..services.agent_workflow_service import WorkflowValidationError

router = APIRouter(prefix="/api/agent-workflows", tags=["agent-workflows"])


async def _get_workflow_or_404(db: AsyncSession, workflow_id: str):
    workflow = await agent_workflow_service.get_workflow(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Agent workflow not found")
    return workflow


@router.get("", response_model=AgentWorkflowListResponse)
async def list_workflows(db: AsyncSession = Depends(get_db)) -> AgentWorkflowListResponse:
    workflows = await agent_workflow_service.list_workflows(db)
    return AgentWorkflowListResponse(workflows=[agent_workflow_service.to_summary(w) for w in workflows])


@router.post("", response_model=AgentWorkflowSummary, status_code=201)
async def create_workflow(
    payload: AgentWorkflowCreate, db: AsyncSession = Depends(get_db)
) -> AgentWorkflowSummary:
    try:
        workflow = await agent_workflow_service.create_workflow(
            db,
            name=payload.name.strip(),
            description=(payload.description or None),
            nodes=payload.nodes,
            edges=payload.edges,
        )
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Workflow name already exists") from exc
    except WorkflowValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return agent_workflow_service.to_summary(workflow)


@router.get("/{workflow_id}", response_model=AgentWorkflowSummary)
async def get_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)) -> AgentWorkflowSummary:
    workflow = await _get_workflow_or_404(db, workflow_id)
    return agent_workflow_service.to_summary(workflow)


@router.patch("/{workflow_id}", response_model=AgentWorkflowSummary)
async def update_workflow(
    workflow_id: str, payload: AgentWorkflowUpdate, db: AsyncSession = Depends(get_db)
) -> AgentWorkflowSummary:
    workflow = await _get_workflow_or_404(db, workflow_id)
    try:
        updated = await agent_workflow_service.update_workflow(
            db,
            workflow,
            description=payload.description,
            nodes=payload.nodes,
            edges=payload.edges,
        )
    except WorkflowValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return agent_workflow_service.to_summary(updated)


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)) -> None:
    await agent_workflow_service.delete_workflow(db, workflow_id)