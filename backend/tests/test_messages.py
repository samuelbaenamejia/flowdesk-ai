from uuid import uuid4

import pytest
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
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["content"] == "Hello, I need help"

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
