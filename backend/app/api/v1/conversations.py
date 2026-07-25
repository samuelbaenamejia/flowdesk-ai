import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.conversation import ConversationResponse, ConversationUpdate

router = APIRouter()

VALID_STATUSES = {"active", "human_takeover", "closed"}


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    subquery_last_msg = (
        select(
            Message.conversation_id,
            Message.content.label("last_content"),
            func.row_number()
            .over(
                partition_by=Message.conversation_id,
                order_by=Message.created_at.desc(),
            )
            .label("rn"),
        )
        .subquery()
    )

    query = (
        select(
            Conversation.id,
            Conversation.contact_id,
            Contact.name.label("contact_name"),
            Conversation.status,
            func.substring(subquery_last_msg.c.last_content, 1, 100).label(
                "last_message_preview"
            ),
            Conversation.last_message_at,
            Conversation.created_at,
            Conversation.updated_at,
        )
        .join(Contact, Conversation.contact_id == Contact.id)
        .outerjoin(
            subquery_last_msg,
            and_(
                subquery_last_msg.c.conversation_id == Conversation.id,
                subquery_last_msg.c.rn == 1,
            ),
        )
    )

    if status_filter is not None:
        if status_filter not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
            )
        query = query.where(Conversation.status == status_filter)

    query = query.order_by(Conversation.last_message_at.desc().nullslast())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": row.id,
            "contact_id": row.contact_id,
            "contact_name": row.contact_name,
            "status": row.status,
            "last_message_preview": row.last_message_preview,
            "last_message_at": row.last_message_at,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]


@router.get("/conversations/{id}", response_model=ConversationResponse)
async def get_conversation(
    id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> dict:
    subquery_last_msg = (
        select(
            Message.conversation_id,
            Message.content.label("last_content"),
            func.row_number()
            .over(
                partition_by=Message.conversation_id,
                order_by=Message.created_at.desc(),
            )
            .label("rn"),
        )
        .subquery()
    )

    query = (
        select(
            Conversation.id,
            Conversation.contact_id,
            Contact.name.label("contact_name"),
            Conversation.status,
            func.substring(subquery_last_msg.c.last_content, 1, 100).label(
                "last_message_preview"
            ),
            Conversation.last_message_at,
            Conversation.created_at,
            Conversation.updated_at,
        )
        .join(Contact, Conversation.contact_id == Contact.id)
        .outerjoin(
            subquery_last_msg,
            and_(
                subquery_last_msg.c.conversation_id == Conversation.id,
                subquery_last_msg.c.rn == 1,
            ),
        )
        .where(Conversation.id == id)
    )

    result = await db.execute(query)
    row = result.one_or_none()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{id}' not found",
        )

    return {
        "id": row.id,
        "contact_id": row.contact_id,
        "contact_name": row.contact_name,
        "status": row.status,
        "last_message_preview": row.last_message_preview,
        "last_message_at": row.last_message_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.patch("/conversations/{id}", response_model=ConversationResponse)
async def update_conversation(
    id: uuid.UUID,
    payload: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
) -> Conversation:
    if payload.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    result = await db.execute(select(Conversation).where(Conversation.id == id))
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{id}' not found",
        )

    conversation.status = payload.status

    await db.commit()
    await db.refresh(conversation)

    return conversation
