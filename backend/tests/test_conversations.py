from uuid import uuid4

from tests.conftest import TEST_CONVERSATION_ID


class TestListConversations:
    async def test_list_conversations_returns_list(
        self, client, auth_headers, test_conversation
    ):
        response = await client.get(
            "/api/v1/conversations", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_list_conversations_requires_auth(self, client):
        response = await client.get("/api/v1/conversations")
        assert response.status_code == 401

    async def test_list_conversations_filters_by_status(
        self, client, auth_headers, test_conversation, db_session
    ):
        test_conversation.status = "closed"
        await db_session.commit()

        response = await client.get(
            "/api/v1/conversations",
            params={"status": "active"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        for conv in data:
            assert conv["status"] == "active"

    async def test_list_conversations_invalid_status_returns_400(
        self, client, auth_headers
    ):
        response = await client.get(
            "/api/v1/conversations",
            params={"status": "invalid_status"},
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestGetConversation:
    async def test_get_conversation_returns_conversation(
        self, client, auth_headers, test_conversation
    ):
        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(TEST_CONVERSATION_ID)
        assert data["status"] == "active"

    async def test_get_conversation_not_found_returns_404(
        self, client, auth_headers
    ):
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/conversations/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert "not found" in response.text

    async def test_get_conversation_requires_auth(self, client):
        response = await client.get(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}"
        )
        assert response.status_code == 401


class TestUpdateConversation:
    async def test_update_conversation_status(
        self, client, auth_headers, test_conversation
    ):
        response = await client.patch(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}",
            json={"status": "human_takeover"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "human_takeover"

    async def test_update_conversation_invalid_status_returns_400(
        self, client, auth_headers
    ):
        response = await client.patch(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}",
            json={"status": "invalid"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_update_conversation_not_found_returns_404(
        self, client, auth_headers
    ):
        fake_id = uuid4()
        response = await client.patch(
            f"/api/v1/conversations/{fake_id}",
            json={"status": "closed"},
            headers=auth_headers,
        )
        assert response.status_code == 404
