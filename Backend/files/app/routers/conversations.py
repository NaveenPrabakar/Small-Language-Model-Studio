from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas import (
    ConversationCreate,
    ConversationSummary,
    ConversationUpdate,
    MessageOut,
)
from ..services import conversation_service

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


async def _get_conversation_or_404(db: AsyncSession, conversation_id: str):
    conversation = await conversation_service.get_conversation(db, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.post("", response_model=ConversationSummary, status_code=201)
async def create_conversation(
    payload: ConversationCreate, db: AsyncSession = Depends(get_db)
) -> ConversationSummary:
    conversation = await conversation_service.create_conversation(
        db, model_id=payload.model_id, title=payload.title
    )
    return ConversationSummary.model_validate(conversation)


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(db: AsyncSession = Depends(get_db)) -> list[ConversationSummary]:
    conversations = await conversation_service.list_conversations(db)
    return [ConversationSummary.model_validate(c) for c in conversations]


@router.get("/{conversation_id}", response_model=ConversationSummary)
async def get_conversation(
    conversation_id: str, db: AsyncSession = Depends(get_db)
) -> ConversationSummary:
    conversation = await _get_conversation_or_404(db, conversation_id)
    return ConversationSummary.model_validate(conversation)


@router.patch("/{conversation_id}", response_model=ConversationSummary)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
) -> ConversationSummary:
    conversation = await _get_conversation_or_404(db, conversation_id)
    updated = await conversation_service.update_conversation(
        db, conversation, title=payload.title, model_id=payload.model_id
    )
    return ConversationSummary.model_validate(updated)


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)) -> None:
    conversation = await _get_conversation_or_404(db, conversation_id)
    await conversation_service.delete_conversation(db, conversation)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(
    conversation_id: str, db: AsyncSession = Depends(get_db)
) -> list[MessageOut]:
    await _get_conversation_or_404(db, conversation_id)
    messages = await conversation_service.list_messages(db, conversation_id)
    return [MessageOut.model_validate(m) for m in messages]

