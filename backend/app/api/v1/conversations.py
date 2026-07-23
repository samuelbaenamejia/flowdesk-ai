import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.conversation import Conversation
from app.schemas.conversation import ConversationResponse, ConversationUpdate

router = APIRouter()

VALID_STATUSES = {"active", "human_takeover", "closed"}


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[Conversation]:
    query = select(Conversation)

    if status_filter is not None:
        if status_filter not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
            )
        query = query.where(Conversation.status == status_filter)

    query = query.order_by(Conversation.created_at.desc())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/conversations/{id}", response_model=ConversationResponse)
async def get_conversation(
    id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> Conversation:
    result = await db.execute(select(Conversation).where(Conversation.id == id))
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{id}' not found",
        )

    return conversation


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
