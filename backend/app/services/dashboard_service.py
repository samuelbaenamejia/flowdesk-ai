from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message, MessageDirection

MESSAGES_OVER_TIME_DAYS = 30
TOP_CONTACTS_LIMIT = 5


def _start_of_today_utc() -> datetime:
    now = datetime.now(UTC)
    return datetime(now.year, now.month, now.day, tzinfo=UTC)


def _start_of_week_utc() -> datetime:
    today = _start_of_today_utc()
    return today - timedelta(days=today.weekday())


async def get_dashboard_stats(db: AsyncSession) -> dict:
    total_result = await db.execute(select(func.count(Conversation.id)))
    total_conversations = total_result.scalar() or 0

    today_start = _start_of_today_utc()
    week_start = _start_of_week_utc()

    today_count_result = await db.execute(
        select(func.count(Message.id)).where(Message.created_at >= today_start)
    )
    messages_today = today_count_result.scalar() or 0

    week_count_result = await db.execute(
        select(func.count(Message.id)).where(Message.created_at >= week_start)
    )
    messages_this_week = week_count_result.scalar() or 0

    first_incoming = (
        select(
            Message.conversation_id,
            func.min(Message.created_at).label("first_incoming_at"),
        )
        .where(Message.direction == MessageDirection.INCOMING)
        .group_by(Message.conversation_id)
        .subquery()
    )
    first_outgoing = (
        select(
            Message.conversation_id,
            func.min(Message.created_at).label("first_outgoing_at"),
        )
        .where(Message.direction == MessageDirection.OUTGOING)
        .group_by(Message.conversation_id)
        .subquery()
    )

    response_pairs_result = await db.execute(
        select(
            first_incoming.c.first_incoming_at,
            first_outgoing.c.first_outgoing_at,
        )
        .join(
            first_outgoing,
            first_incoming.c.conversation_id == first_outgoing.c.conversation_id,
        )
        .where(first_outgoing.c.first_outgoing_at > first_incoming.c.first_incoming_at)
    )
    pairs = response_pairs_result.all()

    responded_conversations = len(pairs)
    response_rate = (
        round(responded_conversations / total_conversations * 100, 1)
        if total_conversations > 0
        else 0.0
    )

    if pairs:
        total_seconds = sum(
            (outgoing - incoming).total_seconds()
            for incoming, outgoing in pairs
        )
        avg_response_time_minutes = round(total_seconds / len(pairs) / 60, 1)
    else:
        avg_response_time_minutes = 0.0

    top_result = await db.execute(
        select(
            Contact.wa_id,
            Contact.name,
            func.count(Message.id).label("message_count"),
        )
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(Contact, Conversation.contact_id == Contact.id)
        .group_by(Contact.id)
        .order_by(func.count(Message.id).desc())
        .limit(TOP_CONTACTS_LIMIT)
    )
    top_contacts = [
        {"wa_id": row.wa_id, "name": row.name, "message_count": row.message_count}
        for row in top_result.all()
    ]

    return {
        "total_conversations": total_conversations,
        "messages_today": messages_today,
        "messages_this_week": messages_this_week,
        "response_rate": response_rate,
        "avg_response_time_minutes": avg_response_time_minutes,
        "top_contacts": top_contacts,
    }


async def get_messages_over_time(db: AsyncSession) -> dict:
    start = _start_of_today_utc() - timedelta(days=MESSAGES_OVER_TIME_DAYS - 1)

    rows_result = await db.execute(
        select(
            func.date(Message.created_at).label("day"),
            func.count(Message.id).label("count"),
        )
        .where(Message.created_at >= start)
        .group_by(func.date(Message.created_at))
    )
    counts_by_day = {str(row.day): row.count for row in rows_result.all()}

    data = []
    for i in range(MESSAGES_OVER_TIME_DAYS):
        day = start + timedelta(days=i)
        day_str = day.date().isoformat()
        data.append({"date": day_str, "count": counts_by_day.get(day_str, 0)})

    return {"data": data}
