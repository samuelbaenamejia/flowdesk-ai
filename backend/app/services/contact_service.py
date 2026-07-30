import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.tag import ContactTag, Tag
from app.schemas.contact import ContactCreate, ContactUpdate
from app.schemas.tag import TagCreate


async def list_contacts(
    db: AsyncSession,
    q: str | None = None,
    limit: int = 25,
    offset: int = 0,
) -> dict:
    base = select(Contact).where(Contact.deleted_at.is_(None))
    count_base = select(func.count(Contact.id)).where(Contact.deleted_at.is_(None))

    if q:
        pattern = f"%{q}%"
        filter_clause = or_(
            Contact.name.ilike(pattern),
            Contact.phone.ilike(pattern),
            Contact.email.ilike(pattern),
            Contact.wa_id.ilike(pattern),
        )
        base = base.where(filter_clause)
        count_base = count_base.where(filter_clause)

    total_result = await db.execute(count_base)
    total = total_result.scalar()

    result = await db.execute(
        base.order_by(Contact.updated_at.desc()).offset(offset).limit(limit)
    )
    contacts = result.scalars().all()

    contacts_with_tags = await _attach_tags(db, contacts)

    return {
        "items": contacts_with_tags,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


async def get_contact(db: AsyncSession, contact_id: uuid.UUID) -> Contact:
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id, Contact.deleted_at.is_(None)
        )
    )
    contact: Contact | None = result.scalar_one_or_none()
    if contact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found",
        )
    contact.tags = await _get_contact_tags(db, contact.id)
    return contact


async def get_contact_by_wa_id(
    db: AsyncSession, wa_id: str
) -> Contact | None:
    result = await db.execute(
        select(Contact).where(
            Contact.wa_id == wa_id, Contact.deleted_at.is_(None)
        )
    )
    return result.scalar_one_or_none()


async def create_contact(
    db: AsyncSession, data: ContactCreate
) -> Contact:
    if data.wa_id:
        existing = await get_contact_by_wa_id(db, data.wa_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Contact with wa_id '{data.wa_id}' already exists",
            )

    contact = Contact(
        wa_id=data.wa_id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        avatar_url=data.avatar_url,
        notes=data.notes,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    contact.tags = []
    return contact


async def update_contact(
    db: AsyncSession,
    contact_id: uuid.UUID,
    data: ContactUpdate,
) -> Contact:
    contact = await get_contact(db, contact_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contact, field, value)

    await db.commit()
    await db.refresh(contact)
    contact.tags = await _get_contact_tags(db, contact.id)
    return contact


async def soft_delete(db: AsyncSession, contact_id: uuid.UUID) -> None:
    contact = await get_contact(db, contact_id)
    contact.deleted_at = datetime.now(UTC)
    await db.commit()


async def hard_delete(db: AsyncSession, contact_id: uuid.UUID) -> None:
    contact = await get_contact(db, contact_id)
    await db.delete(contact)
    await db.commit()


async def list_tags(db: AsyncSession) -> list[Tag]:
    result = await db.execute(select(Tag).order_by(Tag.name))
    return list(result.scalars().all())


async def create_tag(db: AsyncSession, data: TagCreate) -> Tag:
    existing = await db.execute(select(Tag).where(Tag.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tag '{data.name}' already exists",
        )

    tag = Tag(name=data.name, color=data.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


async def delete_tag(db: AsyncSession, tag_id: uuid.UUID) -> None:
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if tag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )

    used = await db.execute(
        select(func.count(ContactTag.id)).where(ContactTag.tag_id == tag_id)
    )
    if used.scalar() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tag is assigned to one or more contacts",
        )

    await db.delete(tag)
    await db.commit()


async def assign_tag(
    db: AsyncSession, contact_id: uuid.UUID, tag_id: uuid.UUID
) -> None:
    await get_contact(db, contact_id)

    tag_result = await db.execute(select(Tag).where(Tag.id == tag_id))
    if tag_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )

    existing = await db.execute(
        select(ContactTag).where(
            ContactTag.contact_id == contact_id,
            ContactTag.tag_id == tag_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tag already assigned to this contact",
        )

    ct = ContactTag(contact_id=contact_id, tag_id=tag_id)
    db.add(ct)
    await db.commit()


async def remove_tag(
    db: AsyncSession, contact_id: uuid.UUID, tag_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(ContactTag).where(
            ContactTag.contact_id == contact_id,
            ContactTag.tag_id == tag_id,
        )
    )
    ct = result.scalar_one_or_none()
    if ct is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not assigned to this contact",
        )

    await db.delete(ct)
    await db.commit()


async def _get_contact_tags(
    db: AsyncSession, contact_id: uuid.UUID
) -> list[Tag]:
    stmt = (
        select(Tag)
        .join(ContactTag, Tag.id == ContactTag.tag_id)
        .where(ContactTag.contact_id == contact_id)
        .order_by(Tag.name)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _attach_tags(
    db: AsyncSession, contacts: list[Contact]
) -> list[Contact]:
    if not contacts:
        return []

    contact_ids = [c.id for c in contacts]
    stmt = (
        select(Tag, ContactTag.contact_id)
        .join(ContactTag, Tag.id == ContactTag.tag_id)
        .where(ContactTag.contact_id.in_(contact_ids))
    )
    result = await db.execute(stmt)
    tag_map: dict[uuid.UUID, list[Tag]] = {cid: [] for cid in contact_ids}
    for tag, cid in result.all():
        tag_map.setdefault(cid, []).append(tag)

    for contact in contacts:
        contact.tags = tag_map.get(contact.id, [])

    return list(contacts)
