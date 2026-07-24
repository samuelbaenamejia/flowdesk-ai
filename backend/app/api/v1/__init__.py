from fastapi import APIRouter

from app.api.v1.contacts import router as contacts_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.messages import router as messages_router

router = APIRouter(prefix="/api/v1")

router.include_router(contacts_router, tags=["contacts"])
router.include_router(conversations_router, tags=["conversations"])
router.include_router(messages_router, tags=["messages"])
