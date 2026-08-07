import uuid
from datetime import UTC, datetime, timedelta
from enum import Enum

from fastapi import HTTPException, status
from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.refresh_token import RefreshToken
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


async def get_profile(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return user


async def update_profile(
    db: AsyncSession, user_id: uuid.UUID, data: dict
) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    for field, value in data.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


async def change_password(
    db: AsyncSession,
    user_id: uuid.UUID,
    current_password: str,
    new_password: str,
) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contraseña actual incorrecta",
        )
    if verify_password(new_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña no puede ser igual a la actual",
        )
    user.hashed_password = hash_password(new_password)
    # Invalidar todos los refresh tokens existentes: obliga a re-login en
    # todos los dispositivos tras un cambio de contraseña (esperado y seguro).
    await db.execute(
        delete(RefreshToken).where(RefreshToken.user_id == user_id)
    )
    await db.commit()
