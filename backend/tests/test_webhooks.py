from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient


def _text_payload(
    phone_number_id: str = "ph-123",
    from_wa: str = "573001234567",
    wa_msg_id: str = "wa_msg_001",
    text_body: str = "Hello",
) -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "entry-1",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "phone_number_id": phone_number_id,
                            },
                            "contacts": [
                                {
                                    "profile": {"name": "Test User"},
                                    "wa_id": from_wa,
                                }
                            ],
                            "messages": [
                                {
                                    "from": from_wa,
                                    "id": wa_msg_id,
                                    "timestamp": "1234567890",
                                    "type": "text",
                                    "text": {"body": text_body},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }


def _status_payload(wa_msg_id: str = "wa_msg_001") -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "entry-1",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"phone_number_id": "ph-123"},
                            "statuses": [
                                {
                                    "id": wa_msg_id,
                                    "status": "read",
                                    "timestamp": "1234567890",
                                    "recipient_id": "573001234567",
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }


class TestVerify:
    async def test_verify_with_correct_token(
        self, client: AsyncClient, monkeypatch
    ):
        monkeypatch.setattr(
            "app.core.config.settings.whatsapp_verify_token", "mytoken"
        )
        response = await client.get(
            "/api/v1/webhooks/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "mytoken",
                "hub.challenge": "12345",
            },
        )
        assert response.status_code == 200
        assert response.text == "12345"

    async def test_verify_with_wrong_token(
        self, client: AsyncClient, monkeypatch
    ):
        monkeypatch.setattr(
            "app.core.config.settings.whatsapp_verify_token", "mytoken"
        )
        response = await client.get(
            "/api/v1/webhooks/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "wrong",
                "hub.challenge": "12345",
            },
        )
        assert response.status_code == 403

    async def test_verify_with_wrong_mode(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/webhooks/whatsapp",
            params={
                "hub.mode": "unsubscribe",
                "hub.verify_token": "token",
                "hub.challenge": "12345",
            },
        )
        assert response.status_code == 403


class TestReceiveInvalid:
    async def test_receive_invalid_json(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            content=b"not json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    async def test_receive_invalid_payload(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json={"invalid": True},
        )
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    async def test_receive_non_whatsapp_object(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json={
                "object": "not_whatsapp",
                "entry": [{"changes": [{"value": {}, "field": ""}]}],
            },
        )
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    async def test_receive_non_text_message_ignored(
        self,
        client: AsyncClient,
        monkeypatch,
        db_session,
    ):
        monkeypatch.setattr(
            "app.core.config.settings.whatsapp_phone_number_id", "ph-123"
        )
        payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "entry-1",
                    "changes": [
                        {
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {
                                    "phone_number_id": "ph-123",
                                },
                                "contacts": [
                                    {
                                        "profile": {"name": "Test"},
                                        "wa_id": "573001234567",
                                    }
                                ],
                                "messages": [
                                    {
                                        "from": "573001234567",
                                        "id": "wa_img_001",
                                        "timestamp": "1234567890",
                                        "type": "image",
                                    }
                                ],
                            },
                            "field": "messages",
                        }
                    ],
                }
            ],
        }
        response = await client.post(
            "/api/v1/webhooks/whatsapp", json=payload
        )
        assert response.status_code == 200

    async def test_receive_phone_number_mismatch(
        self, client: AsyncClient, monkeypatch
    ):
        monkeypatch.setattr(
            "app.core.config.settings.whatsapp_phone_number_id",
            "different-ph",
        )
        response = await client.post(
            "/api/v1/webhooks/whatsapp", json=_text_payload()
        )
        assert response.status_code == 200


class TestReceiveMessage:
    @pytest.fixture
    def settings_phone(self, monkeypatch):
        monkeypatch.setattr(
            "app.core.config.settings.whatsapp_phone_number_id", "ph-123"
        )

    async def test_receive_creates_contact_and_conversation(
        self,
        client: AsyncClient,
        settings_phone,
        mock_groq,
        mock_whatsapp,
        db_session,
    ):
        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="new_msg_001"),
        )
        assert response.status_code == 200

        from app.models.contact import Contact
        from sqlalchemy import select

        result = await db_session.execute(
            select(Contact).where(Contact.wa_id == "573001234567")
        )
        contact = result.scalar_one_or_none()
        assert contact is not None
        assert contact.name == "Test User"

        from app.models.conversation import Conversation

        result = await db_session.execute(
            select(Conversation).where(Conversation.contact_id == contact.id)
        )
        conversation = result.scalar_one_or_none()
        assert conversation is not None
        assert conversation.status == "active"

    async def test_receive_reuses_existing_active_conversation(
        self,
        client: AsyncClient,
        settings_phone,
        test_contact,
        test_conversation,
        mock_groq,
        mock_whatsapp,
        db_session,
    ):
        from app.models.conversation import Conversation
        from sqlalchemy import select

        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="existing_conv_msg"),
        )
        assert response.status_code == 200

        result = await db_session.execute(
            select(Conversation).where(
                Conversation.contact_id == test_contact.id
            )
        )
        conversations = result.scalars().all()
        assert len(conversations) == 1
        assert conversations[0].id == test_conversation.id

    async def test_receive_human_takeover_does_not_reply(
        self,
        client: AsyncClient,
        settings_phone,
        test_contact,
        test_conversation,
        db_session,
        monkeypatch,
    ):
        test_conversation.status = "human_takeover"
        await db_session.commit()

        mock_generate = AsyncMock()
        monkeypatch.setattr(
            "app.services.message_service.generate_response", mock_generate
        )

        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="takeover_msg"),
        )
        assert response.status_code == 200
        mock_generate.assert_not_called()

    async def test_receive_closed_creates_new_conversation(
        self,
        client: AsyncClient,
        settings_phone,
        test_contact,
        test_conversation,
        db_session,
        mock_groq,
        mock_whatsapp,
    ):
        test_conversation.status = "closed"
        await db_session.commit()

        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="closed_msg"),
        )
        assert response.status_code == 200

        from app.models.conversation import Conversation
        from sqlalchemy import select

        result = await db_session.execute(
            select(Conversation).where(
                Conversation.contact_id == test_contact.id
            )
        )
        conversations = result.scalars().all()
        assert len(conversations) == 2

        closed_conv = next(c for c in conversations if c.id == test_conversation.id)
        assert closed_conv.status == "closed"

        new_conv = next(c for c in conversations if c.id != test_conversation.id)
        assert new_conv.status == "active"

    async def test_receive_groq_failure_uses_fallback(
        self,
        client: AsyncClient,
        settings_phone,
        test_contact,
        test_conversation,
        db_session,
        mock_whatsapp,
        monkeypatch,
    ):
        from app.clients.groq import GroqError

        async def mock_groq_error(messages):
            raise GroqError(500, "API error")

        monkeypatch.setattr(
            "app.services.message_service.generate_response",
            mock_groq_error,
        )

        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="groq_fail"),
        )
        assert response.status_code == 200

    async def test_receive_whatsapp_failure_still_returns_200(
        self,
        client: AsyncClient,
        settings_phone,
        test_contact,
        test_conversation,
        db_session,
        mock_groq,
        monkeypatch,
    ):
        from app.clients.whatsapp import WhatsAppSendError

        async def mock_wa_error(to, text):
            raise WhatsAppSendError(400, "Bad request")

        monkeypatch.setattr(
            "app.services.message_service.send_text_message",
            mock_wa_error,
        )

        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="wa_fail"),
        )
        assert response.status_code == 200

    async def test_receive_status_not_found(
        self,
        client: AsyncClient,
        settings_phone,
    ):
        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_status_payload(wa_msg_id="nonexistent_msg"),
        )
        assert response.status_code == 200

    async def test_receive_status_update(
        self,
        client: AsyncClient,
        settings_phone,
        test_conversation,
        db_session,
    ):
        from app.models.message import Message
        from sqlalchemy import select

        msg = Message(
            conversation_id=test_conversation.id,
            direction="outgoing",
            content_type="text",
            content="Test",
            wa_message_id="wa_status_msg",
            status="sent",
        )
        db_session.add(msg)
        await db_session.commit()

        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_status_payload(wa_msg_id="wa_status_msg"),
        )
        assert response.status_code == 200

        await db_session.refresh(msg)
        assert msg.status == "read"

    async def test_receive_duplicate_wa_message_id(
        self,
        client: AsyncClient,
        settings_phone,
        test_contact,
        test_conversation,
        mock_groq,
        mock_whatsapp,
        db_session,
    ):
        response1 = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="dup_msg"),
        )
        assert response1.status_code == 200

        response2 = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="dup_msg"),
        )
        assert response2.status_code == 200


class TestN8nModes:
    @pytest.fixture
    def settings_phone(self, monkeypatch):
        monkeypatch.setattr(
            "app.core.config.settings.whatsapp_phone_number_id", "ph-123"
        )

    @pytest.fixture
    def enable_n8n(self, monkeypatch):
        monkeypatch.setattr(
            "app.core.config.settings.n8n_enabled", True
        )
        monkeypatch.setattr(
            "app.core.config.settings.n8n_webhook_url",
            "http://n8n.test/webhook",
        )

    async def test_n8n_disabled_no_notification(
        self,
        client: AsyncClient,
        settings_phone,
        test_conversation,
        mock_groq,
        mock_whatsapp,
        mock_n8n_notify,
    ):
        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="n8n_disabled"),
        )
        assert response.status_code == 200
        assert mock_n8n_notify["count"] == 0

    async def test_n8n_mirror_notifies_and_replies(
        self,
        client: AsyncClient,
        settings_phone,
        enable_n8n,
        test_conversation,
        mock_groq,
        mock_whatsapp,
        mock_n8n_notify,
        monkeypatch,
    ):
        monkeypatch.setattr(
            "app.core.config.settings.n8n_mode", "mirror"
        )

        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="mirror_mode"),
        )
        assert response.status_code == 200
        assert mock_n8n_notify["count"] == 1

    async def test_n8n_primary_notifies_but_does_not_reply(
        self,
        client: AsyncClient,
        settings_phone,
        enable_n8n,
        test_conversation,
        mock_n8n_notify,
        monkeypatch,
    ):
        monkeypatch.setattr(
            "app.core.config.settings.n8n_mode", "primary"
        )

        mock_groq = AsyncMock()
        import app.services.message_service as ms

        gp = pytest.MonkeyPatch()
        gp.setattr(ms, "generate_response", mock_groq)

        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="primary_mode"),
        )
        assert response.status_code == 200
        assert mock_n8n_notify["count"] == 1
        mock_groq.assert_not_called()

        gp.undo()

    async def test_n8n_notify_failure_does_not_break_flow(
        self,
        client: AsyncClient,
        settings_phone,
        enable_n8n,
        test_conversation,
        mock_groq,
        mock_whatsapp,
        monkeypatch,
    ):
        monkeypatch.setattr(
            "app.core.config.settings.n8n_mode", "mirror"
        )

        async def mock_notify_fail(*args, **kwargs):
            raise RuntimeError("Network error")

        monkeypatch.setattr(
            "app.api.v1.webhooks._notify_n8n", mock_notify_fail
        )

        response = await client.post(
            "/api/v1/webhooks/whatsapp",
            json=_text_payload(wa_msg_id="n8n_fail"),
        )
        assert response.status_code == 200
