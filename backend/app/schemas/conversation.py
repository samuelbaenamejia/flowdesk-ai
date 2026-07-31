import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ConversationUpdate(BaseModel):
    status: str


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    contact_id: uuid.UUID
    contact_name: str
    status: str
    last_message_preview: str | None
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ConversationListResponse(BaseModel):
    items: list[ConversationResponse]
    total: int
    limit: int
    offset: int
