import pytest


class TestGetContact:
    async def test_get_contact_returns_contact(
        self, client, auth_headers, test_contact
    ):
        response = await client.get(
            f"/api/v1/contacts/{test_contact.wa_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["wa_id"] == test_contact.wa_id
        assert data["name"] == "Test Contact"

    async def test_get_contact_not_found_returns_404(
        self, client, auth_headers
    ):
        response = await client.get(
            "/api/v1/contacts/nonexistent_wa_id",
            headers=auth_headers,
        )
        assert response.status_code == 404
        assert "not found" in response.text

    async def test_get_contact_requires_auth(self, client, test_contact):
        response = await client.get(
            f"/api/v1/contacts/{test_contact.wa_id}"
        )
        assert response.status_code == 401


class TestUpdateContact:
    async def test_update_contact_name(
        self, client, auth_headers, test_contact
    ):
        response = await client.patch(
            f"/api/v1/contacts/{test_contact.wa_id}",
            json={"name": "Updated Name"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["wa_id"] == test_contact.wa_id

    async def test_update_contact_not_found_returns_404(
        self, client, auth_headers
    ):
        response = await client.patch(
            "/api/v1/contacts/nonexistent",
            json={"name": "New Name"},
            headers=auth_headers,
        )
        assert response.status_code == 404
