from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from ..database import get_db
from ..schemas import (
    AgentCreate,
    AgentListResponse,
    AgentSummary,
    SkillCreate,
    SkillListResponse,
    SkillSummary,
)
from ..services import preset_service

router = APIRouter(prefix="/api", tags=["presets"])


@router.get("/agents", response_model=AgentListResponse)
async def list_agents(db: AsyncSession = Depends(get_db)) -> AgentListResponse:
    agents = await preset_service.list_agents(db)
    return AgentListResponse(agents=[AgentSummary.model_validate(agent) for agent in agents])


@router.post("/agents", response_model=AgentSummary, status_code=201)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)) -> AgentSummary:
    try:
        agent = await preset_service.create_agent(
            db, name=payload.name.strip(), system_prompt=payload.system_prompt.strip()
        )
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Agent name already exists") from exc
    return AgentSummary.model_validate(agent)


@router.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)) -> None:
    await preset_service.delete_agent(db, agent_id)


@router.get("/skills", response_model=SkillListResponse)
async def list_skills(db: AsyncSession = Depends(get_db)) -> SkillListResponse:
    skills = await preset_service.list_skills(db)
    return SkillListResponse(skills=[SkillSummary.model_validate(skill) for skill in skills])


@router.post("/skills", response_model=SkillSummary, status_code=201)
async def create_skill(payload: SkillCreate, db: AsyncSession = Depends(get_db)) -> SkillSummary:
    try:
        skill = await preset_service.create_skill(
            db, name=payload.name.strip(), instructions=payload.instructions.strip()
        )
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Skill name already exists") from exc
    return SkillSummary.model_validate(skill)


@router.delete("/skills/{skill_id}", status_code=204)
async def delete_skill(skill_id: str, db: AsyncSession = Depends(get_db)) -> None:
    await preset_service.delete_skill(db, skill_id)
