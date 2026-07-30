import uuid


class TestListTags:
    async def test_list_tags_empty(self, client, auth_headers):
        response = await client.get("/api/v1/tags", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_tags_returns_tags(self, client, auth_headers, db_session):
        from app.models.tag import Tag

        db_session.add_all([
            Tag(name="vip", color="#ff0000"),
            Tag(name="support", color="#00ff00"),
        ])
        await db_session.commit()

        response = await client.get("/api/v1/tags", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        names = [t["name"] for t in data]
        assert "vip" in names
        assert "support" in names

    async def test_list_tags_requires_auth(self, client):
        response = await client.get("/api/v1/tags")
        assert response.status_code == 401


class TestCreateTag:
    async def test_create_tag_minimal(self, client, auth_headers):
        response = await client.post(
            "/api/v1/tags",
            json={"name": "vip"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "vip"
        assert data["color"] == "#6366f1"

    async def test_create_tag_with_color(self, client, auth_headers):
        response = await client.post(
            "/api/v1/tags",
            json={"name": "urgent", "color": "#ff0000"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "urgent"
        assert data["color"] == "#ff0000"

    async def test_create_tag_duplicate_name(self, client, auth_headers, db_session):
        from app.models.tag import Tag

        db_session.add(Tag(name="vip"))
        await db_session.commit()

        response = await client.post(
            "/api/v1/tags",
            json={"name": "vip"},
            headers=auth_headers,
        )
        assert response.status_code == 409

    async def test_create_tag_invalid_color(self, client, auth_headers):
        response = await client.post(
            "/api/v1/tags",
            json={"name": "bad", "color": "red"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_create_tag_requires_auth(self, client):
        response = await client.post(
            "/api/v1/tags",
            json={"name": "vip"},
        )
        assert response.status_code == 401


class TestDeleteTag:
    async def test_delete_tag(self, client, auth_headers, db_session):
        from app.models.tag import Tag

        tag = Tag(name="delete-me")
        db_session.add(tag)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/tags/{tag.id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

    async def test_delete_tag_in_use_returns_409(
        self, client, auth_headers, test_contact, db_session
    ):
        from app.models.tag import ContactTag, Tag

        tag = Tag(name="in-use")
        db_session.add(tag)
        await db_session.commit()

        ct = ContactTag(contact_id=test_contact.id, tag_id=tag.id)
        db_session.add(ct)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/tags/{tag.id}",
            headers=auth_headers,
        )
        assert response.status_code == 409

    async def test_delete_tag_not_found(self, client, auth_headers):
        response = await client.delete(
            f"/api/v1/tags/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_delete_tag_requires_auth(self, client, db_session):
        from app.models.tag import Tag

        tag = Tag(name="no-auth")
        db_session.add(tag)
        await db_session.commit()

        response = await client.delete(f"/api/v1/tags/{tag.id}")
        assert response.status_code == 401
