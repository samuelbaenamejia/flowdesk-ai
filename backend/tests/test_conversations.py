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
        assert isinstance(data, dict)
        assert "items" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert len(data["items"]) >= 1
        assert data["total"] >= 1

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
        for conv in data["items"]:
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

    async def test_list_conversations_search_by_contact_name(
        self, client, auth_headers, test_conversation, db_session
    ):
        from app.models.contact import Contact

        second_contact = Contact(
            wa_id="573001234568",
            name="Juan Perez",
            phone="573001234568",
        )
        db_session.add(second_contact)
        await db_session.commit()

        from uuid import uuid4

        from app.models.conversation import Conversation

        second_conv = Conversation(
            id=uuid4(),
            contact_id=second_contact.id,
            status="active",
        )
        db_session.add(second_conv)
        await db_session.commit()

        response = await client.get(
            "/api/v1/conversations",
            params={"q": "juan"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["contact_name"] == "Juan Perez"

    async def test_list_conversations_search_by_phone(
        self, client, auth_headers, test_conversation, db_session
    ):
        from uuid import uuid4

        from app.models.contact import Contact
        from app.models.conversation import Conversation

        second_contact = Contact(
            wa_id="573009999999",
            name="Maria Garcia",
            phone="573099999999",
        )
        db_session.add(second_contact)
        await db_session.commit()

        second_conv = Conversation(
            id=uuid4(),
            contact_id=second_contact.id,
            status="active",
        )
        db_session.add(second_conv)
        await db_session.commit()

        response = await client.get(
            "/api/v1/conversations",
            params={"q": "57309999"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["contact_name"] == "Maria Garcia"

    async def test_list_conversations_search_no_results(
        self, client, auth_headers, test_conversation
    ):
        response = await client.get(
            "/api/v1/conversations",
            params={"q": "noexiste"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_list_conversations_search_empty_query_returns_all(
        self, client, auth_headers, test_conversation
    ):
        response = await client.get(
            "/api/v1/conversations",
            params={"q": ""},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    async def test_list_conversations_filters_by_date_from(
        self, client, auth_headers, test_conversation, db_session
    ):
        from datetime import UTC, datetime, timedelta
        from uuid import uuid4

        from app.models.contact import Contact
        from app.models.conversation import Conversation

        second_contact = Contact(
            wa_id="573009999998",
            name="Carlos Ruiz",
            phone="573009999998",
        )
        db_session.add(second_contact)
        await db_session.commit()

        old_date = datetime.now(UTC) - timedelta(days=10)
        second_conv = Conversation(
            id=uuid4(),
            contact_id=second_contact.id,
            status="active",
            created_at=old_date,
        )
        db_session.add(second_conv)
        await db_session.commit()

        response = await client.get(
            "/api/v1/conversations",
            params={"date_from": (datetime.now(UTC) - timedelta(days=5)).isoformat()},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    async def test_list_conversations_filters_by_date_to(
        self, client, auth_headers, test_conversation, db_session
    ):
        from datetime import UTC, datetime, timedelta
        from uuid import uuid4

        from app.models.contact import Contact
        from app.models.conversation import Conversation

        second_contact = Contact(
            wa_id="573009999997",
            name="Ana Lopez",
            phone="573009999997",
        )
        db_session.add(second_contact)
        await db_session.commit()

        old_date = datetime.now(UTC) - timedelta(days=10)
        second_conv = Conversation(
            id=uuid4(),
            contact_id=second_contact.id,
            status="active",
            created_at=old_date,
        )
        db_session.add(second_conv)
        await db_session.commit()

        response = await client.get(
            "/api/v1/conversations",
            params={"date_to": (datetime.now(UTC) - timedelta(days=5)).isoformat()},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    async def test_list_conversations_search_and_status_combined(
        self, client, auth_headers, test_conversation, db_session
    ):
        from uuid import uuid4

        from app.models.contact import Contact
        from app.models.conversation import Conversation

        second_contact = Contact(
            wa_id="573009999996",
            name="Luis Torres",
            phone="573009999996",
        )
        db_session.add(second_contact)
        await db_session.commit()

        second_conv = Conversation(
            id=uuid4(),
            contact_id=second_contact.id,
            status="closed",
        )
        db_session.add(second_conv)
        await db_session.commit()

        response = await client.get(
            "/api/v1/conversations",
            params={"q": "luis", "status": "closed"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["contact_name"] == "Luis Torres"
        assert data["items"][0]["status"] == "closed"

    async def test_list_conversations_pagination(
        self, client, auth_headers, test_conversation, db_session
    ):
        from uuid import uuid4

        from app.models.contact import Contact
        from app.models.conversation import Conversation

        for i in range(5):
            contact = Contact(
                wa_id=f"57300999999{i}",
                name=f"Pagination Contact {i}",
                phone=f"57300999999{i}",
            )
            db_session.add(contact)
            await db_session.commit()
            conv = Conversation(
                id=uuid4(),
                contact_id=contact.id,
                status="active",
            )
            db_session.add(conv)
            await db_session.commit()

        response = await client.get(
            "/api/v1/conversations",
            params={"limit": 2, "offset": 0},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 6
        assert data["limit"] == 2
        assert data["offset"] == 0

        response = await client.get(
            "/api/v1/conversations",
            params={"limit": 2, "offset": 2},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["offset"] == 2

    async def test_list_conversations_invalid_limit_returns_422(
        self, client, auth_headers
    ):
        response = await client.get(
            "/api/v1/conversations",
            params={"limit": 0},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_list_conversations_invalid_date_returns_422(
        self, client, auth_headers
    ):
        response = await client.get(
            "/api/v1/conversations",
            params={"date_from": "not-a-date"},
            headers=auth_headers,
        )
        assert response.status_code == 422


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
