from uuid import uuid4

from httpx import AsyncClient

from tests.conftest import TEST_CONVERSATION_ID


class TestMarkConversationRead:
    async def test_mark_read_resets_unread_count(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_conversation,
        db_session,
    ):
        test_conversation.unread_count = 3
        await db_session.commit()

        response = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/read",
            headers=auth_headers,
        )
        assert response.status_code == 204

        detail = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}",
            headers=auth_headers,
        )
        assert detail.status_code == 200
        assert detail.json()["unread_count"] == 0

    async def test_mark_read_is_idempotent(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_conversation,
        db_session,
    ):
        test_conversation.unread_count = 2
        await db_session.commit()

        first = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/read",
            headers=auth_headers,
        )
        assert first.status_code == 204

        second = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/read",
            headers=auth_headers,
        )
        assert second.status_code == 204

        detail = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}",
            headers=auth_headers,
        )
        assert detail.json()["unread_count"] == 0

    async def test_mark_read_not_found_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ):
        response = await client.post(
            f"/api/v1/conversations/{uuid4()}/read",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_mark_read_requires_auth(
        self, client: AsyncClient, test_conversation
    ):
        response = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/read",
        )
        assert response.status_code == 401

    async def test_outgoing_message_does_not_increment_unread(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_conversation,
        mock_whatsapp,
    ):
        response = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            json={"content": "Hola, te confirmo"},
            headers=auth_headers,
        )
        assert response.status_code == 201

        detail = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}",
            headers=auth_headers,
        )
        assert detail.status_code == 200
        assert detail.json()["unread_count"] == 0
