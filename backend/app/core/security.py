import logging
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)

DEFAULT_SECRETS = {
    "change-me",
    "change-me-in-production",
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
}

SECRET_MIN_LENGTH = 32
TOKEN_MIN_LENGTH = 16
ENV_EXAMPLE_DATABASE_URL = "postgresql+asyncpg://user:password@host:5432/flowdesk"


def _validate_secret(
    name: str, value: str, min_length: int | None = None
) -> list[str]:
    """Devuelve la lista de errores para un secreto en producción."""
    if not value or not value.strip():
        return [f"{name} está vacía"]

    normalized = value.strip().lower()
    if normalized in DEFAULT_SECRETS:
        return [f"{name} es un valor placeholder por defecto"]

    if min_length is not None and len(normalized) < min_length:
        return [f"{name} tiene {len(normalized)} caracteres (< {min_length})"]

    return []


def validate_settings() -> None:
    from app.core.config import settings

    if settings.environment.strip().lower() != "production":
        return

    errors: list[str] = []

    errors.extend(_validate_secret("SECRET_KEY", settings.secret_key, SECRET_MIN_LENGTH))
    errors.extend(
        _validate_secret(
            "INTERNAL_API_KEY", settings.internal_api_key, SECRET_MIN_LENGTH
        )
    )

    database_url = (settings.database_url or "").strip()
    if not database_url:
        errors.append("DATABASE_URL está vacía")
    elif database_url == ENV_EXAMPLE_DATABASE_URL:
        errors.append("DATABASE_URL usa el valor placeholder del .env.example")

    # En modo primary, el envío lo orquesta n8n y el backend no necesita el token.
    if not (settings.n8n_enabled and settings.n8n_mode == "primary"):
        errors.extend(
            _validate_secret(
                "WHATSAPP_ACCESS_TOKEN",
                settings.whatsapp_access_token,
                TOKEN_MIN_LENGTH,
            )
        )

    errors.extend(
        _validate_secret(
            "WHATSAPP_VERIFY_TOKEN", settings.whatsapp_verify_token
        )
    )
    errors.extend(
        _validate_secret(
            "WHATSAPP_APP_SECRET", settings.whatsapp_app_secret, SECRET_MIN_LENGTH
        )
    )

    if not (settings.whatsapp_phone_number_id or "").strip():
        errors.append("WHATSAPP_PHONE_NUMBER_ID está vacía")

    if errors:
        raise RuntimeError(
            "Validación de producción fallida. Refusing to start.\n"
            + "\n".join(f"  - {e}" for e in errors)
        )


class InMemoryRateLimiter:
    def __init__(self, max_attempts: int = 5, window_seconds: int = 300):
        self._max_attempts = max_attempts
        self._window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)

    async def __call__(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window_start = now - self._window_seconds

        timestamps = self._attempts[client_ip]
        timestamps[:] = [t for t in timestamps if t > window_start]

        if len(timestamps) >= self._max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos. Intenta de nuevo en unos minutos.",
            )

        timestamps.append(now)


rate_limit_login = InMemoryRateLimiter(max_attempts=5, window_seconds=300)
