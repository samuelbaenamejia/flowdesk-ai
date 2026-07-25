import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models.user import User
from app.services.auth_service import hash_password

DEFAULT_EMAIL = "admin@flowdesk.com"
DEFAULT_PASSWORD = "admin123"


async def create_admin(
    email: str = DEFAULT_EMAIL,
    password: str = DEFAULT_PASSWORD,
) -> None:
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing is not None:
            print(f"User '{email}' already exists. Skipping.")
            return

        user = User(
            email=email,
            hashed_password=hash_password(password),
            is_active=True,
        )
        session.add(user)
        await session.commit()
        print(f"Admin user created: {email}")


if __name__ == "__main__":
    asyncio.run(create_admin())
