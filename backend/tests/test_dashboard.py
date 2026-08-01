import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message, MessageDirection

pytestmark = pytest.mark.asyncio


def _make_conversation(contact_id: uuid.UUID, days_ago: int = 0) -> Conversation:
    return Conversation(
        id=uuid.uuid4(),
        contact_id=contact_id,
        status="active",
        created_at=datetime.now(UTC) - timedelta(days=days_ago),
        updated_at=datetime.now(UTC) - timedelta(days=days_ago),
    )


def _make_message(
    conversation_id: uuid.UUID,
    direction: MessageDirection,
    hours_ago: float,
) -> Message:
    return Message(
        id=uuid.uuid4(),
        conversation_id=conversation_id,
        direction=direction,
        content_type="text",
        content=f"{direction} message",
        status="sent",
        created_at=datetime.now(UTC) - timedelta(hours=hours_ago),
    )


async def _create_contact(db: AsyncSession, name: str, wa_id: str) -> Contact:
    contact = Contact(
        id=uuid.uuid4(),
        wa_id=wa_id,
        name=name,
        phone=wa_id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(contact)
    await db.flush()
    return contact


async def test_stats_with_no_data_returns_zeros(client, auth_headers):
    response = await client.get("/api/v1/dashboard/stats", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total_conversations"] == 0
    assert body["messages_today"] == 0
    assert body["messages_this_week"] == 0
    assert body["response_rate"] == 0.0
    assert body["avg_response_time_minutes"] == 0.0
    assert body["top_contacts"] == []


async def test_stats_with_known_data(
    db_session: AsyncSession, client, auth_headers
):
    now = datetime.now(UTC)

    c1 = await _create_contact(db_session, "Carlos Uno", "573001111111")
    c2 = await _create_contact(db_session, "Maria Dos", "573002222222")
    c3 = await _create_contact(db_session, "Luis Tres", "573003333333")
    c4 = await _create_contact(db_session, "Ana Cuatro", "573004444444")
    c5 = await _create_contact(db_session, "Pablo Cinco", "573005555555")

    conv1 = _make_conversation(c1.id)
    conv2 = _make_conversation(c2.id)
    conv3 = _make_conversation(c3.id, days_ago=10)
    conv4 = _make_conversation(c4.id, days_ago=10)
    conv5 = _make_conversation(c5.id)
    db_session.add_all([conv1, conv2, conv3, conv4, conv5])
    await db_session.flush()

    today = datetime(now.year, now.month, now.day, tzinfo=UTC)
    ten_days_ago = today - timedelta(days=10)

    messages = [
        # conv1: first incoming 10d ago 10:00, first outgoing 10d ago 10:30 -> 30 min
        Message(
            id=uuid.uuid4(),
            conversation_id=conv1.id,
            direction=MessageDirection.INCOMING,
            content_type="text",
            content="viejo in",
            status="sent",
            created_at=ten_days_ago + timedelta(hours=10),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=conv1.id,
            direction=MessageDirection.OUTGOING,
            content_type="text",
            content="viejo out",
            status="sent",
            created_at=ten_days_ago + timedelta(hours=10, minutes=30),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=conv1.id,
            direction=MessageDirection.INCOMING,
            content_type="text",
            content="hoy",
            status="sent",
            created_at=today + timedelta(hours=10, minutes=5),
        ),
        # conv2: first incoming 10d ago 08:00, first outgoing 10d ago 08:03 -> 3 min
        Message(
            id=uuid.uuid4(),
            conversation_id=conv2.id,
            direction=MessageDirection.INCOMING,
            content_type="text",
            content="pedido",
            status="sent",
            created_at=ten_days_ago + timedelta(hours=8),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=conv2.id,
            direction=MessageDirection.OUTGOING,
            content_type="text",
            content="ok",
            status="sent",
            created_at=ten_days_ago + timedelta(hours=8, minutes=3),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=conv2.id,
            direction=MessageDirection.INCOMING,
            content_type="text",
            content="consulta",
            status="sent",
            created_at=today + timedelta(hours=9),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=conv2.id,
            direction=MessageDirection.OUTGOING,
            content_type="text",
            content="respuesta",
            status="sent",
            created_at=today + timedelta(hours=9, minutes=12),
        ),
        # conv3: outgoing 10d ago without prior incoming (excluded), today pair
        Message(
            id=uuid.uuid4(),
            conversation_id=conv3.id,
            direction=MessageDirection.OUTGOING,
            content_type="text",
            content="iniciada vieja",
            status="sent",
            created_at=ten_days_ago + timedelta(hours=7),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=conv3.id,
            direction=MessageDirection.INCOMING,
            content_type="text",
            content="hola",
            status="sent",
            created_at=today + timedelta(hours=11),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=conv3.id,
            direction=MessageDirection.OUTGOING,
            content_type="text",
            content="buenas",
            status="sent",
            created_at=today + timedelta(hours=11, minutes=5),
        ),
        # conv4: incoming only, never responded
        Message(
            id=uuid.uuid4(),
            conversation_id=conv4.id,
            direction=MessageDirection.INCOMING,
            content_type="text",
            content="sin respuesta",
            status="sent",
            created_at=ten_days_ago + timedelta(hours=6),
        ),
        # conv5: outgoing only (agent initiated), no pair
        Message(
            id=uuid.uuid4(),
            conversation_id=conv5.id,
            direction=MessageDirection.OUTGOING,
            content_type="text",
            content="iniciada",
            status="sent",
            created_at=today + timedelta(hours=12),
        ),
    ]
    db_session.add_all(messages)
    await db_session.commit()

    response = await client.get("/api/v1/dashboard/stats", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()

    assert body["total_conversations"] == 5
    assert body["messages_today"] == 6
    assert body["messages_this_week"] == 6
    assert body["response_rate"] == 40.0
    assert body["avg_response_time_minutes"] == 16.5

    assert len(body["top_contacts"]) == 5
    assert body["top_contacts"][0] == {
        "wa_id": "573002222222",
        "name": "Maria Dos",
        "message_count": 4,
    }
    assert {c["name"] for c in body["top_contacts"][1:3]} == {
        "Carlos Uno",
        "Luis Tres",
    }
    assert all(c["message_count"] == 3 for c in body["top_contacts"][1:3])
    assert body["top_contacts"][3]["message_count"] == 1
    assert body["top_contacts"][4]["message_count"] == 1


async def test_stats_requires_auth(client):
    response = await client.get("/api/v1/dashboard/stats")
    assert response.status_code == 401


async def test_messages_over_time_returns_30_days(
    db_session: AsyncSession, client, auth_headers
):
    now = datetime.now(UTC)
    today = datetime(now.year, now.month, now.day, tzinfo=UTC)

    contact = await _create_contact(db_session, "Contacto", "573009999999")
    conversation = _make_conversation(contact.id)
    db_session.add(conversation)
    await db_session.flush()

    messages = [
        Message(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            direction=MessageDirection.INCOMING,
            content_type="text",
            content="hoy",
            status="sent",
            created_at=today + timedelta(hours=12),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            direction=MessageDirection.INCOMING,
            content_type="text",
            content="hoy 2",
            status="sent",
            created_at=today + timedelta(hours=13),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            direction=MessageDirection.INCOMING,
            content_type="text",
            content="ayer",
            status="sent",
            created_at=today - timedelta(days=1) + timedelta(hours=12),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            direction=MessageDirection.INCOMING,
            content_type="text",
            content="fuera de ventana",
            status="sent",
            created_at=today - timedelta(days=40),
        ),
    ]
    db_session.add_all(messages)
    await db_session.commit()

    response = await client.get(
        "/api/v1/dashboard/messages-over-time", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()

    assert len(body["data"]) == 30
    assert body["data"][0]["date"] == (today - timedelta(days=29)).date().isoformat()
    assert body["data"][-1]["date"] == today.date().isoformat()
    assert body["data"][-1]["count"] == 2
    assert body["data"][-2]["count"] == 1
    assert all(
        point["count"] == 0 for point in body["data"][:-2]
    )


async def test_messages_over_time_requires_auth(client):
    response = await client.get("/api/v1/dashboard/messages-over-time")
    assert response.status_code == 401
