import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.config import settings
from app.core.database import Base
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message, MessageDirection
from app.models.user import User
from app.services.auth_service import hash_password

TEST_DATABASE_URL = "sqlite+aiosqlite://"
TEST_INTERNAL_API_KEY = "test-internal-key"

TEST_USER_ID = uuid.uuid4()
TEST_CONTACT_ID = uuid.uuid4()
TEST_CONVERSATION_ID = uuid.uuid4()
TEST_PASSWORD = "TestPass123!"
_TEST_HASH = None


# Ensure internal API key is set for tests
settings.internal_api_key = TEST_INTERNAL_API_KEY


def _get_test_user_hash() -> str:
    global _TEST_HASH
    if _TEST_HASH is None:
        _TEST_HASH = hash_password(TEST_PASSWORD)
    return _TEST_HASH


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator:
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session) -> AsyncGenerator:
    from app.main import app

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session) -> User:
    user = User(
        id=TEST_USER_ID,
        email="test@example.com",
        hashed_password=_get_test_user_hash(),
        is_active=True,
        created_at=datetime.now(UTC),
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def test_contact(db_session) -> Contact:
    contact = Contact(
        id=TEST_CONTACT_ID,
        wa_id="573001234567",
        name="Test Contact",
        phone="573001234567",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db_session.add(contact)
    await db_session.commit()
    return contact


@pytest_asyncio.fixture
async def test_conversation(db_session, test_contact: Contact) -> Conversation:
    conversation = Conversation(
        id=TEST_CONVERSATION_ID,
        contact_id=test_contact.id,
        status="active",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db_session.add(conversation)
    await db_session.commit()
    return conversation


@pytest_asyncio.fixture
async def test_message(
    db_session, test_conversation: Conversation
) -> Message:
    message = Message(
        conversation_id=test_conversation.id,
        direction=MessageDirection.INCOMING,
        content_type="text",
        content="Hello, I need help",
        status="sent",
        created_at=datetime.now(UTC),
    )
    db_session.add(message)
    await db_session.commit()
    return message


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, test_user: User) -> dict[str, str]:
    from app.services.auth_service import create_access_token

    token = create_access_token(data={"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def internal_headers() -> dict[str, str]:
    return {"X-Internal-Key": TEST_INTERNAL_API_KEY}


@pytest.fixture
def mock_groq(monkeypatch):
    async def mock_generate_response(messages):
        return "This is a mock response from Groq"

    monkeypatch.setattr(
        "app.services.message_service.generate_response",
        mock_generate_response,
    )


@pytest.fixture
def mock_whatsapp(monkeypatch):
    async def mock_send_text_message(to, text):
        return f"mock_wa_msg_{uuid.uuid4().hex[:12]}"

    monkeypatch.setattr(
        "app.services.message_service.send_text_message",
        mock_send_text_message,
    )
