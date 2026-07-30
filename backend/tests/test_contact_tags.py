class TestAssignTag:
    async def test_assign_tag_to_contact(
        self, client, auth_headers, test_contact, db_session
    ):
        from app.models.tag import Tag

        tag = Tag(name="vip")
        db_session.add(tag)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/contacts/{test_contact.id}/tags",
            json={"tag_id": str(tag.id)},
            headers=auth_headers,
        )
        assert response.status_code == 204

        get_response = await client.get(
            f"/api/v1/contacts/{test_contact.id}",
            headers=auth_headers,
        )
        assert get_response.status_code == 200
        tags = get_response.json()["tags"]
        assert len(tags) == 1
        assert tags[0]["name"] == "vip"

    async def test_assign_duplicate_tag_returns_409(
        self, client, auth_headers, test_contact, db_session
    ):
        from app.models.tag import ContactTag, Tag

        tag = Tag(name="dup")
        db_session.add(tag)
        await db_session.commit()

        ct = ContactTag(contact_id=test_contact.id, tag_id=tag.id)
        db_session.add(ct)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/contacts/{test_contact.id}/tags",
            json={"tag_id": str(tag.id)},
            headers=auth_headers,
        )
        assert response.status_code == 409

    async def test_assign_tag_to_nonexistent_contact(self, client, auth_headers, db_session):
        from app.models.tag import Tag
        import uuid

        tag = Tag(name="orphan-tag")
        db_session.add(tag)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/contacts/{uuid.uuid4()}/tags",
            json={"tag_id": str(tag.id)},
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_assign_nonexistent_tag(self, client, auth_headers, test_contact):
        import uuid

        response = await client.post(
            f"/api/v1/contacts/{test_contact.id}/tags",
            json={"tag_id": str(uuid.uuid4())},
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_assign_tag_requires_auth(self, client, test_contact, db_session):
        from app.models.tag import Tag

        tag = Tag(name="no-auth")
        db_session.add(tag)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/contacts/{test_contact.id}/tags",
            json={"tag_id": str(tag.id)},
        )
        assert response.status_code == 401


class TestRemoveTag:
    async def test_remove_tag_from_contact(
        self, client, auth_headers, test_contact, db_session
    ):
        from app.models.tag import ContactTag, Tag

        tag = Tag(name="remove-me")
        db_session.add(tag)
        await db_session.commit()

        ct = ContactTag(contact_id=test_contact.id, tag_id=tag.id)
        db_session.add(ct)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/contacts/{test_contact.id}/tags/{tag.id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        get_response = await client.get(
            f"/api/v1/contacts/{test_contact.id}",
            headers=auth_headers,
        )
        assert get_response.json()["tags"] == []

    async def test_remove_tag_not_assigned_returns_404(
        self, client, auth_headers, test_contact
    ):
        import uuid

        response = await client.delete(
            f"/api/v1/contacts/{test_contact.id}/tags/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_remove_tag_requires_auth(self, client, test_contact, db_session):
        from app.models.tag import Tag

        tag = Tag(name="no-auth")
        db_session.add(tag)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/contacts/{test_contact.id}/tags/{tag.id}",
        )
        assert response.status_code == 401
