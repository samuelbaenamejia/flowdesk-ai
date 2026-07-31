import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class MessageCreate(BaseModel):
    content: str

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


class MessageListResponse(BaseModel):
    items: list[MessageResponse]
    total: int
    limit: int
    offset: int


class SearchMessageResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    contact_name: str
    content: str
    direction: str
    created_at: datetime
    highlight: str
