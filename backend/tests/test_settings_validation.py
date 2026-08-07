import pytest

from app.core.config import settings
from app.core.security import validate_settings


@pytest.fixture
def prod_settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "internal_api_key", "a" * 48)
    monkeypatch.setattr(settings, "secret_key", "b" * 48)
    monkeypatch.setattr(settings, "database_url", "postgresql+asyncpg://real:user@db:5432/flowdesk")
    monkeypatch.setattr(settings, "whatsapp_verify_token", "c" * 24)
    monkeypatch.setattr(settings, "whatsapp_access_token", "d" * 64)
    monkeypatch.setattr(settings, "whatsapp_app_secret", "e" * 48)
    monkeypatch.setattr(settings, "whatsapp_phone_number_id", "123456789")
    monkeypatch.setattr(settings, "n8n_enabled", False)
    monkeypatch.setattr(settings, "n8n_mode", "disabled")
    return settings


class TestProductionValidConfig:
    async def test_production_with_valid_internal_api_key_starts(self, prod_settings):
        # No debe lanzar
        validate_settings()


class TestProductionInvalidInternalApiKey:
    @pytest.mark.parametrize(
        "bad_key",
        [
            "",
            "   ",
            "change-me",
            "changeme",
            "default",
            "test",
            "testing",
            "dev",
            "development",
            "example",
            "your-key",
            "secret",
            "123456",
            "password",
        ],
    )
    async def test_production_fails_with_placeholder_or_empty_key(
        self, prod_settings, bad_key: str
    ):
        prod_settings.internal_api_key = bad_key
        with pytest.raises(RuntimeError, match="INTERNAL_API_KEY"):
            validate_settings()

    async def test_production_fails_when_key_has_whitespace_only(
        self, prod_settings
    ):
        prod_settings.internal_api_key = " \t\n "
        with pytest.raises(RuntimeError, match="INTERNAL_API_KEY"):
            validate_settings()

    async def test_production_fails_when_key_too_short(self, prod_settings):
        prod_settings.internal_api_key = "a" * 31
        with pytest.raises(RuntimeError, match="INTERNAL_API_KEY"):
            validate_settings()

    async def test_production_lowercase_placeholder_detected(self, prod_settings):
        prod_settings.internal_api_key = "Change-Me"
        with pytest.raises(RuntimeError, match="INTERNAL_API_KEY"):
            validate_settings()

    async def test_production_fails_when_key_missing_from_env(
        self, prod_settings, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(settings, "internal_api_key", "")
        with pytest.raises(RuntimeError, match="INTERNAL_API_KEY"):
            validate_settings()


class TestProductionOtherCriticalVars:
    async def test_production_fails_placeholder_secret_key(self, prod_settings):
        prod_settings.secret_key = "change-me-in-production"
        with pytest.raises(RuntimeError, match="SECRET_KEY"):
            validate_settings()

    async def test_production_fails_empty_secret_key(self, prod_settings):
        prod_settings.secret_key = ""
        with pytest.raises(RuntimeError, match="SECRET_KEY"):
            validate_settings()

    async def test_production_fails_empty_database_url(self, prod_settings):
        prod_settings.database_url = ""
        with pytest.raises(RuntimeError, match="DATABASE_URL"):
            validate_settings()

    async def test_production_fails_placeholder_database_url(self, prod_settings):
        prod_settings.database_url = (
            "postgresql+asyncpg://user:password@host:5432/flowdesk"
        )
        with pytest.raises(RuntimeError, match="DATABASE_URL"):
            validate_settings()

    async def test_production_fails_empty_whatsapp_verify_token(self, prod_settings):
        prod_settings.whatsapp_verify_token = ""
        with pytest.raises(RuntimeError, match="WHATSAPP_VERIFY_TOKEN"):
            validate_settings()

    async def test_production_allows_short_whatsapp_verify_token(self, prod_settings):
        # Sin longitud mínima: solo no vacío y no placeholder
        prod_settings.whatsapp_verify_token = "ab"
        validate_settings()

    async def test_production_fails_empty_whatsapp_access_token(self, prod_settings):
        prod_settings.whatsapp_access_token = ""
        with pytest.raises(RuntimeError, match="WHATSAPP_ACCESS_TOKEN"):
            validate_settings()

    async def test_production_fails_empty_whatsapp_app_secret(self, prod_settings):
        prod_settings.whatsapp_app_secret = ""
        with pytest.raises(RuntimeError, match="WHATSAPP_APP_SECRET"):
            validate_settings()


class TestDevelopmentUnchanged:
    async def test_development_allows_defaults(self):
        # environment por defecto es "development"; no debe validar nada
        validate_settings()

    async def test_development_ignores_empty_internal_key(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(settings, "internal_api_key", "")
        validate_settings()