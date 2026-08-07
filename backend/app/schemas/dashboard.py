
from pydantic import BaseModel


class TopContact(BaseModel):
    wa_id: str | None
    name: str
    message_count: int


class DashboardStats(BaseModel):
    total_conversations: int
    messages_today: int
    messages_this_week: int
    response_rate: float
    avg_response_time_minutes: float
    top_contacts: list[TopContact]


class MessagesOverTimePoint(BaseModel):
    date: str
    count: int


class MessagesOverTimeResponse(BaseModel):
    data: list[MessagesOverTimePoint]
