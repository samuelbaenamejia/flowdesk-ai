import logging
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)

DEFAULT_SECRETS = {"change-me-in-production"}


def validate_settings() -> None:
    from app.core.config import settings

    sensitive = {
        "SECRET_KEY": settings.secret_key,
        "INTERNAL_API_KEY": settings.internal_api_key,
    }
    for name, value in sensitive.items():
        if value in DEFAULT_SECRETS:
            logger.warning(
                "%s is set to a default/placeholder value — replace it before deploying to production",
                name,
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
