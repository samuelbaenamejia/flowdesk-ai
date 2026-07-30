import uuid
from datetime import UTC, datetime, timedelta
from enum import Enum

from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


class TokenErrorCode(str, Enum):
    EXPIRED = "token_expired"
    INVALID = "token_invalid"
    MALFORMED = "token_malformed"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode.update(
        {
            "type": "access",
            "exp": datetime.now(UTC)
            + timedelta(minutes=settings.access_token_expire_minutes),
            "iat": datetime.now(UTC),
        }
    )
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(data: dict, jti: str) -> str:
    to_encode = data.copy()
    to_encode.update(
        {
            "type": "refresh",
            "jti": jti,
            "exp": datetime.now(UTC)
            + timedelta(minutes=settings.refresh_token_expire_minutes),
            "iat": datetime.now(UTC),
        }
    )
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(
    token: str,
) -> tuple[dict | None, TokenErrorCode | None]:
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[ALGORITHM],
            options={"leeway": 30}
        )
        return payload, None
    except ExpiredSignatureError:
        return None, TokenErrorCode.EXPIRED
    except JWTError:
        return None, TokenErrorCode.INVALID


async def get_user_by_email(email: str, db: AsyncSession) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()
