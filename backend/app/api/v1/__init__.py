from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.contacts import router as contacts_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.messages import router as messages_router
from app.api.v1.webhooks import router as webhooks_router

router = APIRouter(prefix="/api/v1")

router.include_router(auth_router, tags=["auth"])
router.include_router(contacts_router, tags=["contacts"])
router.include_router(conversations_router, tags=["conversations"])
router.include_router(messages_router, tags=["messages"])
router.include_router(webhooks_router, tags=["webhooks"])
