from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.contact import Contact
from app.schemas.contact import ContactResponse, ContactUpdate

router = APIRouter()


@router.get("/contacts/{wa_id}", response_model=ContactResponse)
async def get_contact(wa_id: str, db: AsyncSession = Depends(get_db)) -> Contact:
    result = await db.execute(select(Contact).where(Contact.wa_id == wa_id))
    contact = result.scalar_one_or_none()

    if contact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with wa_id '{wa_id}' not found",
        )

    return contact


@router.patch("/contacts/{wa_id}", response_model=ContactResponse)
async def update_contact(
    wa_id: str,
    payload: ContactUpdate,
    db: AsyncSession = Depends(get_db),
) -> Contact:
    result = await db.execute(select(Contact).where(Contact.wa_id == wa_id))
    contact = result.scalar_one_or_none()

    if contact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with wa_id '{wa_id}' not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contact, field, value)

    await db.commit()
    await db.refresh(contact)

    return contact
