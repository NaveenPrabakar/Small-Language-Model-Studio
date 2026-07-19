from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Agent, Skill


async def list_agents(db: AsyncSession) -> list[Agent]:
    result = await db.execute(select(Agent).order_by(Agent.created_at.asc()))
    return list(result.scalars().all())


async def create_agent(db: AsyncSession, *, name: str, system_prompt: str) -> Agent:
    agent = Agent(name=name, system_prompt=system_prompt)
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


async def delete_agent(db: AsyncSession, agent_id: str) -> None:
    await db.execute(delete(Agent).where(Agent.id == agent_id))
    await db.commit()


async def get_agent_by_name(db: AsyncSession, name: str) -> Agent | None:
    result = await db.execute(select(Agent).where(Agent.name == name))
    return result.scalar_one_or_none()


async def list_skills(db: AsyncSession) -> list[Skill]:
    result = await db.execute(select(Skill).order_by(Skill.created_at.asc()))
    return list(result.scalars().all())


async def create_skill(db: AsyncSession, *, name: str, instructions: str) -> Skill:
    skill = Skill(name=name, instructions=instructions)
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill


async def delete_skill(db: AsyncSession, skill_id: str) -> None:
    await db.execute(delete(Skill).where(Skill.id == skill_id))
    await db.commit()


async def get_skill_by_name(db: AsyncSession, name: str) -> Skill | None:
    result = await db.execute(select(Skill).where(Skill.name == name))
    return result.scalar_one_or_none()
