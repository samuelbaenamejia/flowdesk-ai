from uuid import uuid4

from httpx import AsyncClient

from tests.conftest import TEST_CONVERSATION_ID


class TestListMessages:
    async def test_list_messages_returns_list(
        self, client: AsyncClient, auth_headers: dict, test_message
    ):
        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 1
        assert data["items"][0]["content"] == "Hello, I need help"

    async def test_list_messages_conversation_not_found_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ):
        response = await client.get(
            f"/api/v1/conversations/{uuid4()}/messages",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_list_messages_requires_auth(self, client: AsyncClient):
        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
        )
        assert response.status_code == 401

    async def test_list_messages_search_by_content(
        self, client: AsyncClient, auth_headers: dict, test_message
    ):
        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            params={"q": "need help"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["content"] == "Hello, I need help"

    async def test_list_messages_search_no_results(
        self, client: AsyncClient, auth_headers: dict, test_message
    ):
        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            params={"q": "no existe"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_list_messages_filters_by_direction(
        self, client: AsyncClient, auth_headers: dict, test_message, db_session
    ):
        from app.models.message import Message, MessageDirection

        outgoing = Message(
            conversation_id=TEST_CONVERSATION_ID,
            direction=MessageDirection.OUTGOING,
            content_type="text",
            content="Outgoing message",
            status="sent",
        )
        db_session.add(outgoing)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            params={"direction": "outgoing"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["direction"] == "outgoing"
        assert data["items"][0]["content"] == "Outgoing message"

    async def test_list_messages_filters_by_status(
        self, client: AsyncClient, auth_headers: dict, test_message, db_session
    ):
        from app.models.message import Message

        failed = Message(
            conversation_id=TEST_CONVERSATION_ID,
            direction="incoming",
            content_type="text",
            content="Failed message",
            status="failed",
        )
        db_session.add(failed)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            params={"status": "failed"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["status"] == "failed"

    async def test_list_messages_filters_by_date_from(
        self, client: AsyncClient, auth_headers: dict, test_message, db_session
    ):
        from datetime import UTC, datetime, timedelta

        from app.models.message import Message

        old = Message(
            conversation_id=TEST_CONVERSATION_ID,
            direction="incoming",
            content_type="text",
            content="Old message",
            status="sent",
            created_at=datetime.now(UTC) - timedelta(days=10),
        )
        db_session.add(old)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            params={"date_from": (datetime.now(UTC) - timedelta(days=5)).isoformat()},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["content"] == "Hello, I need help"

    async def test_list_messages_filters_by_date_to(
        self, client: AsyncClient, auth_headers: dict, test_message, db_session
    ):
        from datetime import UTC, datetime, timedelta

        from app.models.message import Message

        old = Message(
            conversation_id=TEST_CONVERSATION_ID,
            direction="incoming",
            content_type="text",
            content="Old message",
            status="sent",
            created_at=datetime.now(UTC) - timedelta(days=10),
        )
        db_session.add(old)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            params={"date_to": (datetime.now(UTC) - timedelta(days=5)).isoformat()},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["content"] == "Old message"

    async def test_list_messages_search_and_direction_combined(
        self, client: AsyncClient, auth_headers: dict, test_message, db_session
    ):
        from app.models.message import Message, MessageDirection

        outgoing = Message(
            conversation_id=TEST_CONVERSATION_ID,
            direction=MessageDirection.OUTGOING,
            content_type="text",
            content="Need help with order",
            status="sent",
        )
        db_session.add(outgoing)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            params={"q": "help", "direction": "outgoing"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["direction"] == "outgoing"

    async def test_list_messages_after_filter_still_works(
        self, client: AsyncClient, auth_headers: dict, test_message
    ):
        from datetime import UTC, datetime

        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            params={"after": datetime.now(UTC).isoformat()},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_list_messages_pagination(
        self, client: AsyncClient, auth_headers: dict, test_message, db_session
    ):
        from app.models.message import Message

        for i in range(4):
            msg = Message(
                conversation_id=TEST_CONVERSATION_ID,
                direction="incoming",
                content_type="text",
                content=f"Pagination message {i}",
                status="sent",
            )
            db_session.add(msg)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            params={"limit": 2, "offset": 0},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 5
        assert data["limit"] == 2
        assert data["offset"] == 0

        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            params={"limit": 2, "offset": 4},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["offset"] == 4


class TestCreateMessage:
    async def test_create_message_returns_201(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_conversation,
        mock_whatsapp,
    ):
        response = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            json={"content": "Hello from test"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "Hello from test"
        assert data["direction"] == "outgoing"
        assert data["conversation_id"] == str(TEST_CONVERSATION_ID)

    async def test_create_message_conversation_not_found_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ):
        fake_id = uuid4()
        response = await client.post(
            f"/api/v1/conversations/{fake_id}/messages",
            json={"content": "Hello"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_create_message_empty_content_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_conversation,
    ):
        response = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            json={"content": "   "},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_create_message_whatsapp_error_returns_502(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_conversation,
        monkeypatch,
    ):
        from app.clients.whatsapp import WhatsAppSendError

        async def mock_send_error(to, text):
            raise WhatsAppSendError(400, "Bad request")

        monkeypatch.setattr(
            "app.services.message_service.send_text_message", mock_send_error
        )

        response = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            json={"content": "Hello"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_create_message_whatsapp_timeout_returns_502(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_conversation,
        monkeypatch,
    ):
        from app.clients.whatsapp import WhatsAppSendError

        async def mock_send_error(to, text):
            raise WhatsAppSendError(503, "Timeout")

        monkeypatch.setattr(
            "app.services.message_service.send_text_message", mock_send_error
        )

        response = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            json={"content": "Hello"},
            headers=auth_headers,
        )
        assert response.status_code == 502

    async def test_create_message_requires_auth(
        self, client: AsyncClient, test_conversation
    ):
        response = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            json={"content": "Hello"},
        )
        assert response.status_code == 401
