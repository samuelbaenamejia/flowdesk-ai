import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.contact import (
    ContactCreate,
    ContactListResponse,
    ContactResponse,
    ContactUpdate,
)
from app.schemas.tag import TagAssignRequest
from app.services import contact_service

router = APIRouter()


@router.get("/contacts", response_model=ContactListResponse)
async def list_contacts(
    q: str | None = None,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await contact_service.list_contacts(
        db, q=q, limit=limit, offset=offset
    )


@router.post("/contacts", response_model=ContactResponse, status_code=201)
async def create_contact(
    payload: ContactCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await contact_service.create_contact(db, payload)


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await contact_service.get_contact(db, contact_id)


@router.patch("/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await contact_service.update_contact(db, contact_id, payload)


@router.delete("/contacts/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await contact_service.soft_delete(db, contact_id)


@router.delete("/contacts/{contact_id}/hard", status_code=204)
async def hard_delete_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await contact_service.hard_delete(db, contact_id)


@router.post(
    "/contacts/{contact_id}/tags",
    status_code=204,
)
async def assign_tag(
    contact_id: uuid.UUID,
    payload: TagAssignRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await contact_service.assign_tag(db, contact_id, payload.tag_id)


@router.delete(
    "/contacts/{contact_id}/tags/{tag_id}",
    status_code=204,
)
async def remove_tag(
    contact_id: uuid.UUID,
    tag_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await contact_service.remove_tag(db, contact_id, tag_id)
