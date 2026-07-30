import time

from app.models.user import User
from app.services.auth_service import create_access_token
from tests.conftest import TEST_PASSWORD


class TestLogin:
    async def test_login_valid_credentials_returns_tokens(
        self, client, test_user: User
    ):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": TEST_PASSWORD},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 15 * 60

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


class TestRefresh:
    async def test_refresh_with_valid_token_returns_new_tokens(
        self, client, test_user: User
    ):
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": TEST_PASSWORD},
        )
        login_data = login_resp.json()
        old_refresh = login_data["refresh_token"]

        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_refresh},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != old_refresh

    async def test_refresh_with_expired_token_returns_401(
        self, client, test_user: User
    ):
        token = create_access_token(data={"sub": str(test_user.id)})
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": token},
        )
        assert response.status_code == 401
        assert "X-Auth-Error" in response.headers
        assert response.headers["X-Auth-Error"] == "token_invalid"

    async def test_refresh_with_access_token_returns_401(
        self, client, test_user: User
    ):
        access_token = create_access_token(data={"sub": str(test_user.id)})
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": access_token},
        )
        assert response.status_code == 401

    async def test_refresh_with_revoked_token_returns_401(
        self, client, test_user: User
    ):
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": TEST_PASSWORD},
        )
        login_data = login_resp.json()
        refresh = login_data["refresh_token"]

        await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refresh},
        )

        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert response.status_code == 401
        assert response.headers.get("X-Auth-Error") == "token_revoked"

    async def test_refresh_rotates_old_token(
        self, client, test_user: User
    ):
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": TEST_PASSWORD},
        )
        login_data = login_resp.json()
        refresh = login_data["refresh_token"]

        await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh},
        )

        second_attempt = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert second_attempt.status_code == 401


class TestLogout:
    async def test_logout_revokes_token(
        self, client, test_user: User
    ):
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": TEST_PASSWORD},
        )
        login_data = login_resp.json()
        refresh = login_data["refresh_token"]

        response = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refresh},
        )
        assert response.status_code == 204

        refresh_attempt = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert refresh_attempt.status_code == 401

    async def test_logout_with_invalid_token_returns_401(
        self, client
    ):
        response = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": "invalidtoken"},
        )
        assert response.status_code == 401


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

    async def test_me_expired_token_returns_x_auth_error(
        self, client, test_user: User
    ):
        token = create_access_token(data={"sub": str(test_user.id)})
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    async def test_me_rejects_refresh_token(
        self, client, test_user: User
    ):
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": TEST_PASSWORD},
        )
        refresh_token = login_resp.json()["refresh_token"]

        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )
        assert response.status_code == 401


class TestProfile:
    async def test_get_profile_returns_profile(
        self, client, auth_headers, test_user
    ):
        response = await client.get(
            "/api/v1/auth/profile", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_user.id)
        assert data["email"] == test_user.email
        assert data["name"] is None
        assert data["avatar_url"] is None

    async def test_get_profile_requires_auth(self, client):
        response = await client.get("/api/v1/auth/profile")
        assert response.status_code == 401

    async def test_update_profile_name(
        self, client, auth_headers
    ):
        response = await client.patch(
            "/api/v1/auth/profile",
            json={"name": "John Doe"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "John Doe"

    async def test_update_profile_avatar(
        self, client, auth_headers
    ):
        response = await client.patch(
            "/api/v1/auth/profile",
            json={"avatar_url": "https://example.com/avatar.png"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["avatar_url"] == "https://example.com/avatar.png"

    async def test_update_profile_clear_fields(
        self, client, auth_headers
    ):
        response = await client.patch(
            "/api/v1/auth/profile",
            json={"name": "Temp Name"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Temp Name"

        response = await client.patch(
            "/api/v1/auth/profile",
            json={"name": None},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] is None

    async def test_update_profile_requires_auth(self, client):
        response = await client.patch(
            "/api/v1/auth/profile",
            json={"name": "John"},
        )
        assert response.status_code == 401


class TestChangePassword:
    async def test_change_password_success(
        self, client, auth_headers
    ):
        response = await client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": TEST_PASSWORD,
                "new_password": "NewPass12345!",
            },
            headers=auth_headers,
        )
        assert response.status_code == 204

        login_response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "NewPass12345!",
            },
        )
        assert login_response.status_code == 200

    async def test_change_password_wrong_current(
        self, client, auth_headers
    ):
        response = await client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "WrongPassword1!",
                "new_password": "NewPass12345!",
            },
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "incorrecta" in response.text

    async def test_change_password_too_short(
        self, client, auth_headers
    ):
        response = await client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": TEST_PASSWORD,
                "new_password": "123",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_change_password_same_as_current(
        self, client, auth_headers
    ):
        response = await client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": TEST_PASSWORD,
                "new_password": TEST_PASSWORD,
            },
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_change_password_requires_auth(self, client):
        response = await client.post(
            "/api/v1/auth/change-password",
            json={
                "current_password": "any",
                "new_password": "NewPass12345!",
            },
        )
        assert response.status_code == 401
