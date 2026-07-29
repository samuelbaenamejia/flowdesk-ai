
from app.models.user import User
from tests.conftest import TEST_PASSWORD


class TestLogin:
    async def test_login_valid_credentials_returns_token(
        self, client, test_user: User
    ):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": TEST_PASSWORD},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_invalid_email_returns_401(self, client):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "wrong@example.com", "password": TEST_PASSWORD},
        )
        assert response.status_code == 401
        assert "Credenciales inválidas" in response.text

    async def test_login_wrong_password_returns_401(
        self, client, test_user: User
    ):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "WrongPass!"},
        )
        assert response.status_code == 401
        assert "Credenciales inválidas" in response.text

    async def test_login_inactive_user_returns_401(
        self, client, db_session, test_user: User
    ):
        test_user.is_active = False
        await db_session.commit()

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": TEST_PASSWORD},
        )
        assert response.status_code == 401
        assert "inactivo" in response.text


class TestMe:
    async def test_me_valid_token_returns_user(
        self, client, auth_headers, test_user: User
    ):
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["is_active"] is True
        assert data["id"] == str(test_user.id)

    async def test_me_no_token_returns_401(self, client):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    async def test_me_invalid_token_returns_401(self, client):
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalidtoken"},
        )
        assert response.status_code == 401
