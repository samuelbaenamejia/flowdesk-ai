from fastapi import APIRouter

from app.api.v1.contacts import router as contacts_router

router = APIRouter(prefix="/api/v1")

router.include_router(contacts_router, tags=["contacts"])
