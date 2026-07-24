import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.clients.whatsapp import WhatsAppSendError, send_text_message
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.message import MessageCreate, MessageResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
async def list_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[Message]:
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{conversation_id}' not found",
        )

    query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
) -> Message:
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        logger.warning(
            "whatsapp.send: conversación no encontrada conversation_id=%s",
            conversation_id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{conversation_id}' not found",
        )

    result = await db.execute(
        select(Contact).where(Contact.id == conversation.contact_id)
    )
    contact = result.scalar_one_or_none()

    if contact is None:
        logger.error(
            "whatsapp.send: contacto no encontrado conversation_id=%s contact_id=%s",
            conversation_id,
            conversation.contact_id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact for conversation '{conversation_id}' not found",
        )

    message = Message(
        conversation_id=conversation_id,
        direction="outgoing",
        content_type="text",
        content=payload.content,
        status="pending",
    )
    db.add(message)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        logger.warning(
            "whatsapp.send: mensaje duplicado conversation_id=%s",
            conversation_id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Message creation failed due to integrity constraint",
        )

    await db.refresh(message)
    logger.info(
        "whatsapp.send: mensaje persistido conversation_id=%s message_id=%s",
        conversation_id,
        message.id,
    )

    try:
        wa_message_id = await send_text_message(contact.wa_id, payload.content)
    except WhatsAppSendError as exc:
        logger.error(
            "whatsapp.send: error Meta conversation_id=%s message_id=%s "
            "meta_status=%s detail=%s",
            conversation_id,
            message.id,
            exc.status_code,
            exc.detail,
        )
        raise HTTPException(
            status_code=exc.status_code,
            detail=f"WhatsApp API error: {exc.detail}",
        )

    logger.info(
        "whatsapp.send: enviado a Meta conversation_id=%s wa_message_id=%s",
        conversation_id,
        wa_message_id,
    )

    message.status = "sent"
    message.wa_message_id = wa_message_id
    conversation.last_message_at = datetime.now(UTC)

    try:
        await db.commit()
    except Exception:
        logger.exception(
            "whatsapp.send: commit fase 3 falló conversation_id=%s "
            "wa_message_id=%s",
            conversation_id,
            wa_message_id,
        )
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail="Message sent to WhatsApp but database update failed",
        )

    await db.refresh(message)
    logger.info(
        "whatsapp.send: completado conversation_id=%s wa_message_id=%s",
        conversation_id,
        wa_message_id,
    )

    return message
