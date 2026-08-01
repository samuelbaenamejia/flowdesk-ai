from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.schemas.dashboard import DashboardStats, MessagesOverTimeResponse
from app.services.dashboard_service import (
    get_dashboard_stats,
    get_messages_over_time,
)

router = APIRouter()


@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
) -> dict:
    return await get_dashboard_stats(db)


@router.get("/dashboard/messages-over-time", response_model=MessagesOverTimeResponse)
async def messages_over_time(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
) -> dict:
    return await get_messages_over_time(db)
