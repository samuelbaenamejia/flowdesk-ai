from uuid import uuid4

from tests.conftest import TEST_CONVERSATION_ID


class TestTriggerAI:
    async def test_trigger_ai_invalid_key_returns_401(self, client):
        response = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/trigger-ai",
            headers={"X-Internal-Key": "wrong-key"},
        )
        assert response.status_code == 401
        assert "Invalid internal API key" in response.text

    async def test_trigger_ai_conversation_not_found_returns_404(
        self, client, internal_headers
    ):
        fake_id = uuid4()
        response = await client.post(
            f"/api/v1/internal/conversations/{fake_id}/trigger-ai",
            headers=internal_headers,
        )
        assert response.status_code == 404
        assert "Conversation not found" in response.text

    async def test_trigger_ai_non_active_conversation_returns_409(
        self, client, internal_headers, test_conversation, db_session
    ):
        test_conversation.status = "human_takeover"
        await db_session.commit()

        response = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/trigger-ai",
            headers=internal_headers,
        )
        assert response.status_code == 409
        assert "not active" in response.text

    async def test_trigger_ai_no_incoming_messages_returns_400(
        self, client, internal_headers, test_conversation
    ):
        response = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/trigger-ai",
            headers=internal_headers,
        )
        assert response.status_code == 400
        assert "No incoming messages" in response.text

    async def test_trigger_ai_success(
        self,
        client,
        internal_headers,
        test_conversation,
        test_message,
        mock_groq,
        mock_whatsapp,
    ):
        response = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/trigger-ai",
            headers=internal_headers,
        )
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    async def test_trigger_ai_is_idempotent(
        self,
        client,
        internal_headers,
        test_conversation,
        test_message,
        mock_groq,
        mock_whatsapp,
    ):
        resp1 = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/trigger-ai",
            headers=internal_headers,
        )
        assert resp1.status_code == 200

        resp2 = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/trigger-ai",
            headers=internal_headers,
        )
        assert resp2.status_code == 200


class TestRequestHumanApproval:
    async def test_approval_invalid_key_returns_401(self, client):
        response = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/request-human-approval",
            headers={"X-Internal-Key": "wrong-key"},
        )
        assert response.status_code == 401
        assert "Invalid internal API key" in response.text

    async def test_approval_conversation_not_found_returns_404(
        self, client, internal_headers
    ):
        fake_id = uuid4()
        response = await client.post(
            f"/api/v1/internal/conversations/{fake_id}/request-human-approval",
            headers=internal_headers,
        )
        assert response.status_code == 404
        assert "Conversation not found" in response.text

    async def test_approval_escalates_active_conversation(
        self, client, internal_headers, test_conversation
    ):
        response = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/request-human-approval",
            headers=internal_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["conversation_status"] == "human_takeover"

    async def test_approval_is_idempotent(
        self, client, internal_headers, test_conversation
    ):
        resp1 = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/request-human-approval",
            headers=internal_headers,
        )
        assert resp1.status_code == 200
        assert resp1.json()["conversation_status"] == "human_takeover"

        resp2 = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/request-human-approval",
            headers=internal_headers,
        )
        assert resp2.status_code == 200
        assert resp2.json()["conversation_status"] == "human_takeover"

    async def test_approval_on_human_takeover_returns_ok(
        self, client, internal_headers, test_conversation, db_session
    ):
        test_conversation.status = "human_takeover"
        await db_session.commit()

        response = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/request-human-approval",
            headers=internal_headers,
        )
        assert response.status_code == 200
        assert response.json()["conversation_status"] == "human_takeover"

    async def test_approval_on_closed_conversation_returns_409(
        self, client, internal_headers, test_conversation, db_session
    ):
        test_conversation.status = "closed"
        await db_session.commit()

        response = await client.post(
            f"/api/v1/internal/conversations/{TEST_CONVERSATION_ID}/request-human-approval",
            headers=internal_headers,
        )
        assert response.status_code == 409
        assert "closed" in response.text
