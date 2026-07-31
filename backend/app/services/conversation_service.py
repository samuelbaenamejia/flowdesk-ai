import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message

VALID_STATUSES = {"active", "human_takeover", "closed"}


async def search_conversations(
    db: AsyncSession,
    q: str | None = None,
    status_filter: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 20,
    offset: int = 0,
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

    base = (
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

    count_base = (
        select(func.count(Conversation.id))
        .select_from(Conversation)
        .join(Contact, Conversation.contact_id == Contact.id)
    )

    if q:
        pattern = f"%{q}%"
        search_clause = or_(
            Contact.name.ilike(pattern),
            Contact.phone.ilike(pattern),
        )
        base = base.where(search_clause)
        count_base = count_base.where(search_clause)

    if status_filter is not None:
        if status_filter not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
            )
        base = base.where(Conversation.status == status_filter)
        count_base = count_base.where(Conversation.status == status_filter)

    if date_from is not None:
        base = base.where(Conversation.created_at >= date_from)
        count_base = count_base.where(Conversation.created_at >= date_from)

    if date_to is not None:
        base = base.where(Conversation.created_at <= date_to)
        count_base = count_base.where(Conversation.created_at <= date_to)

    total_result = await db.execute(count_base)
    total = total_result.scalar()

    query = base.order_by(Conversation.last_message_at.desc().nullslast())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    items = [
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

    return {"items": items, "total": total, "limit": limit, "offset": offset}


async def get_conversation(
    db: AsyncSession, conversation_id: uuid.UUID
) -> dict | None:
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
        .where(Conversation.id == conversation_id)
    )

    result = await db.execute(query)
    row = result.one_or_none()

    if row is None:
        return None

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


async def update_conversation_status(
    db: AsyncSession, conversation_id: uuid.UUID, new_status: str
) -> Conversation:
    if new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{conversation_id}' not found",
        )

    conversation.status = new_status
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def get_contact_name(
    db: AsyncSession, contact_id: uuid.UUID
) -> str:
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()
    return contact.name if contact else ""
