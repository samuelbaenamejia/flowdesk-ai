import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ContactUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    wa_id: str
    name: str
    phone: str | None
    avatar_url: str | None
    created_at: datetime
    updated_at: datetime
