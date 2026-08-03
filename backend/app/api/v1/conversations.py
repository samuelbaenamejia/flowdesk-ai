import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.schemas.conversation import (
    ConversationListResponse,
    ConversationResponse,
    ConversationUpdate,
)
from app.services.conversation_service import (
    get_contact_name,
    mark_conversation_read,
    search_conversations,
    update_conversation_status,
)
from app.services.conversation_service import (
    get_conversation as service_get_conversation,
)

router = APIRouter()


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    q: str | None = Query(None, description="Search by contact name or phone"),
    status_filter: str | None = Query(None, alias="status"),
    date_from: datetime | None = Query(
        None, description="Filter conversations created from this date"
    ),
    date_to: datetime | None = Query(
        None, description="Filter conversations created until this date"
    ),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
) -> dict:
    return await search_conversations(
        db,
        q=q,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )


@router.get("/conversations/{id}", response_model=ConversationResponse)
async def get_conversation(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
) -> dict:
    result = await service_get_conversation(db, id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{id}' not found",
        )
    return result


@router.post(
    "/conversations/{id}/read", status_code=status.HTTP_204_NO_CONTENT
)
async def mark_read(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
) -> None:
    conversation = await mark_conversation_read(db, id)
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{id}' not found",
        )


@router.patch("/conversations/{id}", response_model=ConversationResponse)
async def update_conversation(
    id: uuid.UUID,
    payload: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
) -> dict:
    conversation = await update_conversation_status(db, id, payload.status)

    contact_name = await get_contact_name(db, conversation.contact_id)

    return {
        "id": conversation.id,
        "contact_id": conversation.contact_id,
        "contact_name": contact_name,
        "status": conversation.status,
        "unread_count": conversation.unread_count,
        "last_message_preview": None,
        "last_message_at": conversation.last_message_at,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
    }
