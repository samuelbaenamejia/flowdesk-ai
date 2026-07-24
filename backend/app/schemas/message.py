import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.message import MessageContentType, MessageDirection


class MessageCreate(BaseModel):
    content: str
    direction: MessageDirection
    content_type: MessageContentType = MessageContentType.TEXT
    wa_message_id: str | None = None

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content must not be empty")
        return v


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    direction: str
    content_type: str
    content: str
    wa_message_id: str | None
    status: str
    created_at: datetime
