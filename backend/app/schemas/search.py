from pydantic import BaseModel

from app.schemas.conversation import ConversationResponse
from app.schemas.message import SearchMessageResult


class GlobalSearchConversations(BaseModel):
    items: list[ConversationResponse]
    total: int


class GlobalSearchMessages(BaseModel):
    items: list[SearchMessageResult]
    total: int


class GlobalSearchResponse(BaseModel):
    conversations: GlobalSearchConversations
    messages: GlobalSearchMessages
