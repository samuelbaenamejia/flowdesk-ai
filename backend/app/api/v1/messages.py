import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.clients.whatsapp import WhatsAppSendError
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.message import (
    MessageCreate,
    MessageListResponse,
    MessageResponse,
)
from app.services.message_service import send_outgoing_message

_META_STATUS_MAP = {
    400: 400,
    401: 401,
    429: 503,
}

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
)
async def list_messages(
    conversation_id: uuid.UUID,
    q: str | None = Query(
        None, description="Search messages by content"
    ),
    direction: str | None = Query(
        None, description="Filter by direction: incoming or outgoing"
    ),
    status_filter: str | None = Query(
        None, alias="status", description="Filter by message status"
    ),
    date_from: datetime | None = Query(
        None, description="Return only messages created from this date"
    ),
    date_to: datetime | None = Query(
        None, description="Return only messages created until this date"
    ),
    after: datetime | None = Query(
        None, description="Return only messages created after this timestamp"
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
) -> dict:
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{conversation_id}' not found",
        )

    count_query = (
        select(func.count(Message.id))
        .where(Message.conversation_id == conversation_id)
    )
    query = select(Message).where(Message.conversation_id == conversation_id)

    if q is not None:
        pattern = f"%{q}%"
        query = query.where(Message.content.ilike(pattern))
        count_query = count_query.where(Message.content.ilike(pattern))

    if direction is not None:
        query = query.where(Message.direction == direction)
        count_query = count_query.where(Message.direction == direction)

    if status_filter is not None:
        query = query.where(Message.status == status_filter)
        count_query = count_query.where(Message.status == status_filter)

    if date_from is not None:
        query = query.where(Message.created_at >= date_from)
        count_query = count_query.where(Message.created_at >= date_from)

    if date_to is not None:
        query = query.where(Message.created_at <= date_to)
        count_query = count_query.where(Message.created_at <= date_to)

    if after is not None:
        query = query.where(Message.created_at > after)
        count_query = count_query.where(Message.created_at > after)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Message.created_at.asc()).offset(offset).limit(limit)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
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

    try:
        message = await send_outgoing_message(conversation_id, payload.content, db)
    except ValueError as exc:
        if "not found" in str(exc).lower():
            logger.warning(
                "whatsapp.send: recurso no encontrado conversation_id=%s",
                conversation_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            )
        logger.warning(
            "whatsapp.send: error de integridad conversation_id=%s",
            conversation_id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except WhatsAppSendError as exc:
        http_status = _META_STATUS_MAP.get(exc.status_code, 502)
        logger.error(
            "whatsapp.send: error Meta conversation_id=%s meta_status=%s detail=%s",
            conversation_id,
            exc.status_code,
            exc.detail,
        )
        raise HTTPException(
            status_code=http_status,
            detail=f"WhatsApp API error: {exc.detail}",
        )
    except Exception:
        logger.exception(
            "whatsapp.send: error inesperado conversation_id=%s",
            conversation_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Internal server error",
        )

    return message
