from pydantic import BaseModel, Field


class WebhookText(BaseModel):
    body: str


class WebhookMessage(BaseModel):
    from_: str = Field(alias="from")
    id: str
    timestamp: str
    type: str
    text: WebhookText | None = None


class WebhookProfile(BaseModel):
    name: str


class WebhookContact(BaseModel):
    wa_id: str
    profile: WebhookProfile


class WebhookMetadata(BaseModel):
    display_phone_number: str | None = None
    phone_number_id: str


class WebhookStatus(BaseModel):
    id: str
    status: str
    timestamp: str
    recipient_id: str


class WebhookValue(BaseModel):
    messaging_product: str | None = None
    metadata: WebhookMetadata | None = None
    contacts: list[WebhookContact] | None = None
    messages: list[WebhookMessage] | None = None
    statuses: list[WebhookStatus] | None = None


class WebhookChange(BaseModel):
    value: WebhookValue
    field: str


class WebhookEntry(BaseModel):
    id: str | None = None
    changes: list[WebhookChange]


class WebhookPayload(BaseModel):
    object: str
    entry: list[WebhookEntry]