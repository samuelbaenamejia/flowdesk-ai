import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.search import GlobalSearchResponse
from app.services.conversation_service import search_conversations

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_SCOPES = {"all", "conversations", "messages"}


def _build_highlight(content: str, query: str, context: int = 50) -> str:
    """Extract a fragment around the first match of query in content."""
    idx = content.lower().find(query.lower())
    if idx < 0:
        return content[:100]
    start = max(0, idx - context)
    end = min(len(content), idx + len(query) + context)
    highlight = content[start:end]
    if start > 0:
        highlight = "..." + highlight
    if end < len(content):
        highlight = highlight + "..."
    return highlight


async def _search_messages_global(
    db: AsyncSession,
    q: str,
    limit: int,
    offset: int,
) -> dict:
    pattern = f"%{q}%"

    count_query = (
        select(func.count(Message.id))
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(Contact, Conversation.contact_id == Contact.id)
        .where(Message.content.ilike(pattern))
        .where(Contact.deleted_at.is_(None))
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = (
        select(
            Message.id,
            Message.conversation_id,
            Contact.name.label("contact_name"),
            Message.content,
            Message.direction,
            Message.created_at,
        )
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(Contact, Conversation.contact_id == Contact.id)
        .where(Message.content.ilike(pattern))
        .where(Contact.deleted_at.is_(None))
        .order_by(Message.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    items = [
        {
            "id": row.id,
            "conversation_id": row.conversation_id,
            "contact_name": row.contact_name,
            "content": row.content,
            "direction": row.direction,
            "created_at": row.created_at,
            "highlight": _build_highlight(row.content, q),
        }
        for row in rows
    ]

    return {"items": items, "total": total}


@router.get("/search", response_model=GlobalSearchResponse)
async def global_search(
    q: str = Query(..., min_length=1, description="Search query"),
    scope: str = Query("all", description="Search scope: all, conversations, or messages"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
) -> dict:
    if scope not in VALID_SCOPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scope. Must be one of: {', '.join(sorted(VALID_SCOPES))}",
        )

    conv_items = []
    conv_total = 0
    msg_items = []
    msg_total = 0

    if scope in ("all", "conversations"):
        conv_result = await search_conversations(
            db, q=q, limit=limit, offset=offset
        )
        conv_items = conv_result["items"]
        conv_total = conv_result["total"]

    if scope in ("all", "messages"):
        msg_result = await _search_messages_global(db, q, limit, offset)
        msg_items = msg_result["items"]
        msg_total = msg_result["total"]

    return {
        "conversations": {"items": conv_items, "total": conv_total},
        "messages": {"items": msg_items, "total": msg_total},
    }
