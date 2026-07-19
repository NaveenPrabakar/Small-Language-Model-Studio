from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..ollama_client import OllamaClient, get_ollama_client
from ..schemas import ChatRequest
from ..services import chat_service, conversation_service

router = APIRouter(prefix="/api/conversations", tags=["chat"])


@router.post("/{conversation_id}/chat")
async def chat(
    conversation_id: str,
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    ollama: OllamaClient = Depends(get_ollama_client),
) -> StreamingResponse:
    """
    Streams a Server-Sent-Events response as the model generates tokens.

    Events emitted, in order:
      user_message       -- echoes the persisted user message (id, content)
      token               -- {"delta": "..."} for each generated chunk
      done                 -- generation stats once Ollama reports done=true
      assistant_message  -- the final persisted assistant message (id, content)
      error                -- {"detail": "..."} if Ollama fails mid-stream
    """
    conversation = await conversation_service.get_conversation(db, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    generator = chat_service.stream_chat_turn(
        conversation_id=conversation_id,
        user_content=payload.content,
        ollama=ollama,
        model_override=payload.model_id,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

