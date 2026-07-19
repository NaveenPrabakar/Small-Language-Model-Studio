from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Conversation, Message, MessageRole


def derive_title(user_content: str) -> str:
    text = " ".join(user_content.strip().split())
    if not text:
        return "New conversation"
    words = re.findall(r"[A-Za-z0-9']+", text)
    if not words:
        return text[:40].rstrip() + ("..." if len(text) > 40 else "")
    title = " ".join(words[:6])
    if len(title) > 48:
        title = title[:45].rstrip() + "..."
    return title[0].upper() + title[1:] if title else "New conversation"


async def get_conversation(db: AsyncSession, conversation_id: str) -> Conversation | None:
    return await db.get(Conversation, conversation_id)


async def create_conversation(
    db: AsyncSession, *, model_id: str, title: str | None = None
) -> Conversation:
    conversation = Conversation(title=title or "New conversation", model_id=model_id)
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def list_conversations(db: AsyncSession) -> list[Conversation]:
    result = await db.execute(
        select(Conversation).order_by(Conversation.updated_at.desc(), Conversation.created_at.desc())
    )
    return list(result.scalars().all())


async def update_conversation(
    db: AsyncSession,
    conversation: Conversation,
    *,
    title: str | None = None,
    model_id: str | None = None,
) -> Conversation:
    if title is not None:
        conversation.title = title
    if model_id is not None:
        conversation.model_id = model_id
    conversation.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def delete_conversation(db: AsyncSession, conversation: Conversation) -> None:
    await db.delete(conversation)
    await db.commit()


async def list_messages(db: AsyncSession, conversation_id: str) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())


async def add_message(
    db: AsyncSession,
    conversation_id: str,
    role: MessageRole,
    content: str,
    *,
    model_id: str | None = None,
) -> Message:
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        model_id=model_id,
    )
    db.add(message)
    conversation = await get_conversation(db, conversation_id)
    if conversation is not None:
        conversation.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(message)
    return message


def to_ollama_messages(messages: list[Message], max_context_messages: int) -> list[dict]:
    context = messages[-max_context_messages:] if max_context_messages > 0 else messages
    return [{"role": message.role.value, "content": message.content} for message in context]

