import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.tag import TagCreate, TagResponse
from app.services import contact_service

router = APIRouter()


@router.get("/tags", response_model=list[TagResponse])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await contact_service.list_tags(db)


@router.post("/tags", response_model=TagResponse, status_code=201)
async def create_tag(
    payload: TagCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await contact_service.create_tag(db, payload)


@router.delete("/tags/{tag_id}", status_code=204)
async def delete_tag(
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await contact_service.delete_tag(db, tag_id)
