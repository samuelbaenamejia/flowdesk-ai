import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.tag import TagResponse


class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    wa_id: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=255)
    avatar_url: str | None = None
    notes: str | None = None


class ContactUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    phone: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=255)
    avatar_url: str | None = None
    notes: str | None = None


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    wa_id: str | None
    name: str
    phone: str | None
    email: str | None
    avatar_url: str | None
    notes: str | None
    last_contacted_at: datetime | None
    tags: list[TagResponse] = []
    created_at: datetime
    updated_at: datetime


class ContactListResponse(BaseModel):
    items: list[ContactResponse]
    total: int
    limit: int
    offset: int
