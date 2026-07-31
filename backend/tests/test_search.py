from tests.conftest import TEST_CONVERSATION_ID


class TestGlobalSearch:
    async def test_search_returns_conversations_and_messages(
        self, client, auth_headers, test_conversation, test_message
    ):
        response = await client.get(
            "/api/v1/search",
            params={"q": "help"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        assert "messages" in data
        assert isinstance(data["conversations"]["items"], list)
        assert isinstance(data["messages"]["items"], list)
        assert data["messages"]["total"] >= 1

    async def test_search_matches_contact_name(
        self, client, auth_headers, test_conversation, test_message
    ):
        response = await client.get(
            "/api/v1/search",
            params={"q": "Test Contact"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["conversations"]["total"] >= 1

    async def test_search_message_contains_highlight(
        self, client, auth_headers, test_conversation, test_message
    ):
        response = await client.get(
            "/api/v1/search",
            params={"q": "help"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        msg = data["messages"]["items"][0]
        assert "help" in msg["highlight"].lower()
        assert msg["conversation_id"] == str(TEST_CONVERSATION_ID)
        assert msg["contact_name"] == "Test Contact"
        assert msg["direction"] == "incoming"

    async def test_search_no_results(self, client, auth_headers):
        response = await client.get(
            "/api/v1/search",
            params={"q": "noexiste"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["conversations"]["total"] == 0
        assert data["conversations"]["items"] == []
        assert data["messages"]["total"] == 0
        assert data["messages"]["items"] == []

    async def test_search_missing_q_returns_422(self, client, auth_headers):
        response = await client.get(
            "/api/v1/search",
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_search_blank_q_returns_empty_results(
        self, client, auth_headers
    ):
        response = await client.get(
            "/api/v1/search",
            params={"q": "   "},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["conversations"]["total"] == 0
        assert data["messages"]["total"] == 0

    async def test_search_scope_conversations_only(
        self, client, auth_headers, test_conversation, test_message
    ):
        response = await client.get(
            "/api/v1/search",
            params={"q": "Test Contact", "scope": "conversations"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["conversations"]["total"] >= 1
        assert data["messages"]["total"] == 0

    async def test_search_scope_messages_only(
        self, client, auth_headers, test_conversation, test_message
    ):
        response = await client.get(
            "/api/v1/search",
            params={"q": "help", "scope": "messages"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["conversations"]["total"] == 0
        assert data["messages"]["total"] >= 1

    async def test_search_invalid_scope_returns_400(
        self, client, auth_headers
    ):
        response = await client.get(
            "/api/v1/search",
            params={"q": "help", "scope": "invalid"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_search_requires_auth(self, client):
        response = await client.get("/api/v1/search", params={"q": "help"})
        assert response.status_code == 401

    async def test_search_pagination(
        self, client, auth_headers, test_conversation, test_message, db_session
    ):
        from app.models.message import Message

        for i in range(5):
            msg = Message(
                conversation_id=TEST_CONVERSATION_ID,
                direction="incoming",
                content_type="text",
                content=f"Searchable content {i}",
                status="sent",
            )
            db_session.add(msg)
        await db_session.commit()

        response = await client.get(
            "/api/v1/search",
            params={"q": "Searchable", "scope": "messages", "limit": 3, "offset": 0},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]["items"]) == 3
        assert data["messages"]["total"] == 5

        response = await client.get(
            "/api/v1/search",
            params={"q": "Searchable", "scope": "messages", "limit": 3, "offset": 3},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]["items"]) == 2

    async def test_search_limit_invalid_returns_422(self, client, auth_headers):
        response = await client.get(
            "/api/v1/search",
            params={"q": "help", "limit": 51},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_search_case_insensitive(
        self, client, auth_headers, test_conversation, test_message
    ):
        response = await client.get(
            "/api/v1/search",
            params={"q": "HELP"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["messages"]["total"] >= 1
