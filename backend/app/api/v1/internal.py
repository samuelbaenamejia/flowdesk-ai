import logging
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.models.conversation import Conversation
from app.models.message import Message, MessageDirection
from app.services.message_service import process_incoming_and_respond

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal")


@router.post("/conversations/{conversation_id}/trigger-ai")
async def trigger_ai(
    conversation_id: uuid.UUID,
    x_internal_key: str = Header(default="", alias="X-Internal-Key"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )

    logger.info(
        "internal.trigger_ai: conversation_id=%s", conversation_id
    )

    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    if conversation.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conversation is not active",
        )

    result = await db.execute(
        select(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.direction == MessageDirection.INCOMING,
        )
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    last_message = result.scalar_one_or_none()

    if last_message is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No incoming messages found",
        )

    await process_incoming_and_respond(conversation_id, last_message.content, db)

    return {"status": "ok"}
