import uuid


class TestListContacts:
    async def test_list_contacts_returns_list(self, client, auth_headers, test_contact):
        response = await client.get("/api/v1/contacts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

    async def test_list_contacts_pagination(self, client, auth_headers, db_session):
        from app.models.contact import Contact

        for i in range(3):
            db_session.add(Contact(name=f"Page Contact {i}"))
        await db_session.commit()

        response = await client.get(
            "/api/v1/contacts?limit=2&offset=0", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] >= 3
        assert data["limit"] == 2
        assert data["offset"] == 0

    async def test_list_contacts_search(self, client, auth_headers, db_session):
        from app.models.contact import Contact

        db_session.add(Contact(name="Alice Wonderland"))
        db_session.add(Contact(name="Bob Marley"))
        await db_session.commit()

        response = await client.get(
            "/api/v1/contacts?q=alice", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert all("alice" in item["name"].lower() for item in data["items"])

    async def test_list_contacts_requires_auth(self, client):
        response = await client.get("/api/v1/contacts")
        assert response.status_code == 401

    async def test_list_contacts_excludes_soft_deleted(
        self, client, auth_headers, test_contact
    ):
        await client.delete(
            f"/api/v1/contacts/{test_contact.id}", headers=auth_headers
        )
        response = await client.get("/api/v1/contacts", headers=auth_headers)
        contact_ids = [c["id"] for c in response.json()["items"]]
        assert str(test_contact.id) not in contact_ids


class TestGetContact:
    async def test_get_contact_by_id_returns_contact(
        self, client, auth_headers, test_contact
    ):
        response = await client.get(
            f"/api/v1/contacts/{test_contact.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_contact.id)
        assert data["name"] == "Test Contact"

    async def test_get_contact_not_found_returns_404(
        self, client, auth_headers
    ):
        response = await client.get(
            f"/api/v1/contacts/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_get_contact_requires_auth(self, client, test_contact):
        response = await client.get(
            f"/api/v1/contacts/{test_contact.id}"
        )
        assert response.status_code == 401


class TestCreateContact:
    async def test_create_contact_minimal(self, client, auth_headers):
        response = await client.post(
            "/api/v1/contacts",
            json={"name": "New Contact"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Contact"
        assert data["wa_id"] is None
        assert data["tags"] == []

    async def test_create_contact_full(self, client, auth_headers):
        response = await client.post(
            "/api/v1/contacts",
            json={
                "name": "Full Contact",
                "wa_id": "573001234568",
                "phone": "573001234568",
                "email": "test@example.com",
                "notes": "Some notes",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Full Contact"
        assert data["wa_id"] == "573001234568"
        assert data["email"] == "test@example.com"
        assert data["notes"] == "Some notes"

    async def test_create_contact_duplicate_wa_id(
        self, client, auth_headers, test_contact
    ):
        response = await client.post(
            "/api/v1/contacts",
            json={"name": "Duplicate", "wa_id": test_contact.wa_id},
            headers=auth_headers,
        )
        assert response.status_code == 409

    async def test_create_contact_requires_auth(self, client):
        response = await client.post(
            "/api/v1/contacts",
            json={"name": "No Auth"},
        )
        assert response.status_code == 401


class TestUpdateContact:
    async def test_update_contact_name(
        self, client, auth_headers, test_contact
    ):
        response = await client.patch(
            f"/api/v1/contacts/{test_contact.id}",
            json={"name": "Updated Name"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"

    async def test_update_contact_not_found_returns_404(
        self, client, auth_headers
    ):
        response = await client.patch(
            f"/api/v1/contacts/{uuid.uuid4()}",
            json={"name": "New Name"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_update_contact_requires_auth(self, client, test_contact):
        response = await client.patch(
            f"/api/v1/contacts/{test_contact.id}",
            json={"name": "No Auth"},
        )
        assert response.status_code == 401


class TestDeleteContact:
    async def test_soft_delete_contact(
        self, client, auth_headers, test_contact
    ):
        response = await client.delete(
            f"/api/v1/contacts/{test_contact.id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        get_response = await client.get(
            f"/api/v1/contacts/{test_contact.id}",
            headers=auth_headers,
        )
        assert get_response.status_code == 404

    async def test_hard_delete_contact(
        self, client, auth_headers, db_session
    ):
        from app.models.contact import Contact

        c = Contact(name="Hard Delete Me")
        db_session.add(c)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/contacts/{c.id}/hard",
            headers=auth_headers,
        )
        assert response.status_code == 204

        db_session.expire_all()
        get_response = await client.get(
            f"/api/v1/contacts/{c.id}",
            headers=auth_headers,
        )
        assert get_response.status_code == 404

    async def test_delete_contact_not_found_returns_404(
        self, client, auth_headers
    ):
        response = await client.delete(
            f"/api/v1/contacts/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_delete_contact_requires_auth(self, client, test_contact):
        response = await client.delete(
            f"/api/v1/contacts/{test_contact.id}"
        )
        assert response.status_code == 401
