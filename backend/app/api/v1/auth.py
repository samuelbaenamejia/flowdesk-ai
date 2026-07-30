import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import rate_limit_login
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserProfileResponse,
    UserResponse,
)
from app.services.auth_service import (
    ALGORITHM,
    TokenErrorCode,
    change_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    get_user_by_email,
    get_profile,
    update_profile,
    verify_password,
)

router = APIRouter(prefix="/auth")


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_login),
) -> TokenResponse:
    user = await get_user_by_email(payload.email, db)

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo",
        )

    return await _issue_tokens(user, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    token_data, error = decode_access_token(payload.refresh_token)

    if error or token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
            headers={"X-Auth-Error": "token_invalid"},
        )

    if token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
            headers={"X-Auth-Error": "token_invalid"},
        )

    jti = token_data.get("jti")
    user_id_raw = token_data.get("sub")

    if not jti or not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
            headers={"X-Auth-Error": "token_invalid"},
        )

    stored_token = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_jti == uuid.UUID(jti),
            RefreshToken.revoked_at.is_(None),
        )
    )
    stored_token = stored_token.scalar_one_or_none()

    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revocado o inexistente",
            headers={"X-Auth-Error": "token_revoked"},
        )

    user_result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id_raw))
    )
    user = user_result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
        )

    stored_token.revoked_at = datetime.now(UTC)

    return await _issue_tokens(user, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: LogoutRequest,
    db: AsyncSession = Depends(get_db),
) -> None:
    token_data, error = decode_access_token(payload.refresh_token)

    if error or token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        )

    jti = token_data.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        )

    stored_token = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_jti == uuid.UUID(jti),
            RefreshToken.revoked_at.is_(None),
        )
    )
    stored_token = stored_token.scalar_one_or_none()

    if stored_token:
        stored_token.revoked_at = datetime.now(UTC)
        await db.commit()


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user


@router.get("/profile", response_model=UserProfileResponse)
async def profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await get_profile(db, current_user.id)


@router.patch("/profile", response_model=UserProfileResponse)
async def update_profile_endpoint(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    data = payload.model_dump(exclude_unset=True)
    return await update_profile(db, current_user.id, data)


@router.post("/change-password", status_code=204)
async def change_password_endpoint(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await change_password(
        db, current_user.id, payload.current_password, payload.new_password
    )


async def _issue_tokens(user: User, db: AsyncSession) -> TokenResponse:
    access_token = create_access_token(data={"sub": str(user.id)})

    jti = str(uuid.uuid4())
    refresh_token = create_refresh_token(
        data={"sub": str(user.id)}, jti=jti
    )

    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.refresh_token_expire_minutes  # type: ignore
    )

    db.add(
        RefreshToken(
            user_id=user.id,
            token_jti=uuid.UUID(jti),
            expires_at=expires_at,
        )
    )
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,  # type: ignore
    )
