# F6B — Contacts CRUD + Tag System

---

## 1. Objective

Implement full Contacts management with CRUD operations, a tag system (tags + contact_tags bridge), soft delete, pagination, search, and a dedicated Contacts page in the frontend.

---

## 2. Current State Audit

### F6A Integration Check

| Component | Status | Evidence |
|---|---|---|
| **Token refresh** | ✅ Integrated | `apiClient.refreshAuth()` available for all requests |
| **Cross-tab sync** | ✅ Working | BroadcastChannel + storage event fallback |
| **Single-flight refresh** | ✅ Verified | `refreshPromise` guard prevents concurrent refreshes |
| **Request queue** | ✅ Verified | Queue drains in `.then()` of refresh promise |
| **Error differentiation** | ✅ Working | `X-Auth-Error: token_expired` vs `token_invalid` |
| **Toast system** | ✅ Wired | `ToastProvider` wraps app, `useToast()` ready |
| **Confirm dialog** | ✅ Available | `ConfirmDialog` component ready for destructive actions |
| **Backend tests** | ✅ 74/74 pass | All existing + F6A tests green |
| **Frontend typecheck** | ✅ 0 source errors | Pre-existing `__tests__/` errors only |

### Existing Contacts Infrastructure

**Backend (`backend/app/`):**

| Layer | File | Current State |
|---|---|---|
| **Model** | `models/contact.py` | `Contact` with: `id`, `wa_id`, `name`, `phone`, `avatar_url`, `created_at`, `updated_at` |
| **Schema** | `schemas/contact.py` | `ContactUpdate` (name, phone, avatar_url), `ContactResponse` |
| **Router** | `api/v1/contacts.py` | `GET /contacts/{wa_id}`, `PATCH /contacts/{wa_id}` — both lookup by `wa_id` |
| **Service** | — | No service layer yet |
| **Tests** | `tests/test_contacts.py` | 5 tests: get (2 successful + 1 auth), update (1 successful + 1 not_found) |

**Key observations:**
- All routes use `wa_id` as the identifier — **problematic** because `wa_id` is a WhatsApp identifier, not an internal PK. This couples the public API to an external system's ID scheme.
- No `email`, `notes`, `last_contacted_at` fields (useful for CRM).
- No soft delete (`deleted_at`).
- No user isolation (contacts are global — appropriate for this app).
- No `contacts.py` service layer — logic is inline in the router.
- `Conversation` already has `ForeignKey("contacts.id")` — no change needed there.
- Default `avatar_url` is never set from webhooks (always `None`).

**Frontend (`frontend/src/`):**

| Layer | Current State |
|---|---|
| **Contacts page** | Does not exist |
| **Contacts API** | Not exported from `api.ts` |
| **Contacts types** | `contact_id`, `contact_name` exist on `Conversation` only |
| **Contacts hooks** | None |
| **Contacts components** | None |

---

## 3. Proposed Architecture

### Design Decisions & Improvements Over Existing

1. **Routes now use `id` (UUID), not `wa_id`** — decouples internal API from WhatsApp. `wa_id` lookup remains available as a query param for webhook internal use.
2. **Add `email`, `notes`, `last_contacted_at`** — CRM-relevant fields skipped in F5 but needed now.
3. **Soft delete** via `deleted_at` — all queries automatically filter `WHERE deleted_at IS NULL`. Destroys are hard-deletes only after confirmation.
4. **Tag system** via bridge table — scalable, indexed, avoids CSV/ARRAY anti-pattern.
5. **Service layer** extracted — `contact_service.py` handles DB logic, router stays thin.
6. **Pagination + search** — query params `?q=&limit=&offset=` on `GET /contacts`.
7. **User isolation** — contacts are NOT isolated by user (multi-agent CRM model). Tags are global too.

### Data Model (ER)

```
┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
│      tags         │       │   contact_tags    │       │     contacts      │
├───────────────────┤       ├───────────────────┤       ├───────────────────┤
│ id (PK UUID)      │──┐    │ id (PK UUID)      │    ┌─│ id (PK UUID)      │
│ name (VARCHAR 50) │  └────│ tag_id (FK UUID)  │    │ │ wa_id (VARCHAR)   │
│ color (VARCHAR 7) │       │ contact_id (FK) ──┼────┘ │ name (VARCHAR)    │
│ created_at        │       │ created_at        │       │ phone (VARCHAR)   │
│                   │       └───────────────────┘       │ email (VARCHAR)   │
│                   │                                    │ avatar_url (TEXT) │
│                   │                                    │ notes (TEXT)      │
│                   │                                    │ last_contacted_at │
│                   │                                    │ deleted_at        │
│                   │                                    │ created_at        │
│                   │                                    │ updated_at        │
│                   │                                    └───────────────────┘
```

### Relationship Rules

- **Contact ↔ Tag**: Many-to-many via `contact_tags`
- **Cascade**: `contact_tags.contact_id` → `ON DELETE CASCADE` (removing a contact removes its tag associations)
- **Cascade**: `contact_tags.tag_id` → `ON DELETE RESTRICT` (prevent deleting a tag that's in use)
- **No `relationship()`** — manual joins per existing convention (no `lazy=`, no backrefs)
- **Unique constraint** on `contact_tags(contact_id, tag_id)` — prevent duplicate tag assignments
- **Unique constraint** on `tags.name` — prevent duplicate tag names

### Indexes

```sql
-- contacts
CREATE INDEX idx_contacts_name ON contacts(name);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_deleted_at ON contacts(deleted_at);

-- tags
CREATE UNIQUE INDEX idx_tags_name ON tags(name);

-- contact_tags
CREATE UNIQUE INDEX idx_contact_tags_pair ON contact_tags(contact_id, tag_id);
CREATE INDEX idx_contact_tags_tag_id ON contact_tags(tag_id);
CREATE INDEX idx_contact_tags_contact_id ON contact_tags(contact_id);

-- existing conversations FK already indexed
-- existing contacts.wa_id already unique-indexed
```

### Soft Delete Pattern

```python
# All contact queries will append:
stmt = select(Contact).where(Contact.deleted_at.is_(None))

# Delete is actually:
contact.deleted_at = datetime.now(UTC)
await db.commit()

# Hard delete (admin, after confirm dialog):
await db.delete(contact)
await db.commit()
```

---

## 4. API Endpoints

### Contacts

| Method | Path | Description | Auth | Pagination | Body |
|---|---|---|---|---|---|
| `GET` | `/api/v1/contacts` | List contacts (paginated, searchable) | ✅ | ✅ `?q=&limit=&offset=` | — |
| `GET` | `/api/v1/contacts/{id}` | Get contact by UUID | ✅ | — | — |
| `POST` | `/api/v1/contacts` | Create contact | ✅ | — | `ContactCreate` |
| `PATCH` | `/api/v1/contacts/{id}` | Update contact | ✅ | — | `ContactUpdate` |
| `DELETE` | `/api/v1/contacts/{id}` | Soft delete contact | ✅ | — | — |
| `DELETE` | `/api/v1/contacts/{id}/hard` | Hard delete (admin) | ✅ | — | — |

### Tags

| Method | Path | Description | Auth | Body |
|---|---|---|---|---|
| `GET` | `/api/v1/tags` | List all tags | ✅ | — |
| `POST` | `/api/v1/tags` | Create tag | ✅ | `TagCreate` |
| `DELETE` | `/api/v1/tags/{id}` | Delete tag (RESTRICT if in use) | ✅ | — |

### Contact-Tag Association

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/contacts/{id}/tags` | Assign tag to contact (body: `{tag_id}`) | ✅ |
| `DELETE` | `/api/v1/contacts/{id}/tags/{tag_id}` | Remove tag from contact | ✅ |

### Response Schemas

```python
# Contacts
class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    wa_id: str | None = Field(None, max_length=50)  # optional for manual creation
    phone: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=255)
    avatar_url: str | None = None
    notes: str | None = None

class ContactUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    phone: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=255)
    avatar_url: str | None = None
    notes: str | None = None

class ContactResponse(BaseModel):
    id: uuid.UUID
    wa_id: str | None
    name: str
    phone: str | None
    email: str | None
    avatar_url: str | None
    notes: str | None
    last_contacted_at: datetime | None
    tags: list[TagResponse]  # included in response
    created_at: datetime
    updated_at: datetime

class ContactListResponse(BaseModel):
    items: list[ContactResponse]
    total: int
    limit: int
    offset: int

# Tags
class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field("#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")

class TagResponse(BaseModel):
    id: uuid.UUID
    name: str
    color: str
    created_at: datetime

# Association
class TagAssignRequest(BaseModel):
    tag_id: uuid.UUID
```

### Query Patterns (Pagination + Search)

```python
@router.get("/contacts", response_model=ContactListResponse)
async def list_contacts(
    q: str | None = None,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await contact_service.list_contacts(db, q=q, limit=limit, offset=offset)

# In service:
async def list_contacts(db, q=None, limit=25, offset=0):
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
        base.order_by(Contact.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    contacts = result.scalars().all()

    # For each contact, fetch tags via join
    contacts_with_tags = await _attach_tags(db, contacts)

    return {"items": contacts_with_tags, "total": total, "limit": limit, "offset": offset}
```

---

## 5. File Changes

### New Files

| File | Purpose |
|---|---|
| `backend/app/models/tag.py` | `Tag` model + `ContactTag` bridge model |
| `backend/app/services/contact_service.py` | Contact business logic (list, get, create, update, soft-delete, hard-delete, tag assign/remove) |
| `backend/app/schemas/tag.py` | `TagCreate`, `TagResponse`, `TagAssignRequest` |
| `backend/app/api/v1/tags.py` | Tag routes (list, create, delete) |
| `backend/alembic/versions/d4e5f6a7b8c9_add_email_notes_deleted_to_contacts.py` | Migration: add columns to contacts |
| `backend/alembic/versions/e5f6a7b8c9d0_create_tags_and_contact_tags.py` | Migration: create tags + contact_tags tables |
| `backend/tests/test_tags.py` | Tag CRUD tests |
| `backend/tests/test_contact_tags.py` | Contact-tag association tests |
| `frontend/src/pages/contacts/index.tsx` | Contacts list page |
| `frontend/src/hooks/useContacts.ts` | Contacts data hook |
| `frontend/src/components/contacts/ContactTable.tsx` | Contacts table component |
| `frontend/src/components/contacts/ContactForm.tsx` | Create/edit contact modal/form |

### Modified Files

| File | Change |
|---|---|
| `backend/app/models/contact.py` | Add: `email`, `notes`, `last_contacted_at`, `deleted_at`. Change: `wa_id` nullable (manual creation). |
| `backend/app/models/__init__.py` | Add: `Tag`, `ContactTag` exports |
| `backend/app/schemas/contact.py` | Add: `ContactCreate`, update `ContactUpdate` (add email, notes), update `ContactResponse` (add email, notes, tags, last_contacted_at), add `ContactListResponse` |
| `backend/app/schemas/__init__.py` | Add tag schema exports |
| `backend/app/api/v1/contacts.py` | Rewrite: add `POST`, `DELETE`, `DELETE /hard`, change routes to use `id`, add service layer delegation |
| `backend/app/api/v1/__init__.py` | Add: tags router |
| `frontend/src/types/index.ts` | Add: `Contact`, `Tag`, `ContactListResponse` types |
| `frontend/src/lib/api.ts` | Add: `getContacts`, `getContact`, `createContact`, `updateContact`, `deleteContact`, `getTags`, `createTag`, `deleteTag`, `assignTag`, `removeTag` |
| `frontend/src/pages/_app.tsx` | Add `/contacts` to AppShell title logic |

---

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Route change: wa_id → id** | Breaks existing API clients | Webhook internal code uses `contact.id` internally; no public clients exist yet. F5 webhook test passes via fixture. |
| **wa_id nullable** | Webhook always sets wa_id | Existing webhook code already sets `wa_id`; new contacts created manually just won't have one. |
| **Tag deletion RESTRICT** | User can't delete tag in use | Return 409 with "Tag is assigned to N contacts" + list contacts. User must unassign first. |
| **Soft delete + cascade** | `conversations.contact_id` FK points to soft-deleted contact | Conversations still reference the contact row. Contact won't appear in lists but its data persists for history. The `ON DELETE CASCADE` on `contact_tags` is safe since we soft-delete (not hard). |
| **Performance: N+1 tags** | Each contact in list triggers a tag query | `_attach_tags` does **one** query for all contacts' tags using `WHERE contact_id IN (...)`, not N queries. |
| **Race condition: duplicate tag assign** | Two concurrent requests assign same tag | Unique constraint on `(contact_id, tag_id)` — second insert fails with integrity error caught as 409. |

---

## 7. Compatibility

| Component | Affected? | Details |
|---|---|---|
| **F5A** (Webhooks) | No | Webhooks create contacts via `Contact(wa_id=..., name=...)` which still works. `wa_id` stays non-null for webhook-created contacts. |
| **F5A** (AI) | No | AI code doesn't touch contacts table. |
| **F5B** (Inbox/Messages) | No | Messages reference conversations, not contacts directly. |
| **F5C** (Conversation Status) | No | `Conversation.contact_id` FK is unchanged. |
| **F5D** (N8N) | No | Internal endpoints don't use contact routes. |
| **F6A** (Auth/Toast) | No | Auth unchanged. Toast/ConfirmDialog ready for new UI. |
| **Existing tests** | **Needs update** | `test_contacts.py` uses `wa_id` routes → must migrate to `id` routes. `wa_id` fixture stays. |

---

## 8. Implementation Strategy

### PR B1: Backend — Models, Migration, Service, Routes

**Scope:** All backend changes for contacts + tags + contact_tags.

**Steps:**
1. Update `Contact` model — add email, notes, last_contacted_at, deleted_at, make wa_id nullable
2. Create `Tag` + `ContactTag` models
3. Migration 1: `d4e5f6a7b8c9` — add columns to contacts
4. Migration 2: `e5f6a7b8c9d0` — create tags + contact_tags tables
5. Create `contact_service.py` — `list_contacts` (search+paginate), `get_contact`, `create_contact`, `update_contact`, `soft_delete`, `hard_delete`, `assign_tag`, `remove_tag`
6. Update `schemas/contact.py` — `ContactCreate`, `ContactListResponse`, update ContactResponse with tags
7. Create `schemas/tag.py` — `TagCreate`, `TagResponse`, `TagAssignRequest`
8. Rewrite `api/v1/contacts.py` — new routes, ID-based, delegate to service
9. Create `api/v1/tags.py` — CRUD routes
10. Update `api/v1/__init__.py` — include tags router
11. Update `models/__init__.py` — export Tag, ContactTag
12. Update tests

**Estimated delta:** ~400 lines

### PR B2: Frontend — Contacts Page, Components, Hooks, API

**Scope:** Complete frontend for contacts management.

**Steps:**
1. Add Contact, Tag types to `src/types/index.ts`
2. Add API functions to `src/lib/api.ts`
3. Create `useContacts` hook with search + pagination
4. Create `ContactTable` component (reuse `Table` molecule pattern)
5. Create `ContactForm` modal (create/edit)
6. Create contacts list page at `src/pages/contacts/index.tsx`
7. Wire into sidebar navigation (existing sidebar already has placeholder?)
8. Implement all states: loading (Skeleton), empty (EmptyState), error (ErrorState + retry), success

**Estimated delta:** ~350 lines

---

## 9. Testing Strategy

### Backend

| Test File | Tests | Description |
|---|---|---|
| `tests/test_contacts.py` | 15-20 tests | `list_contacts` (empty, paginated, filtered, searched), `get_contact`, `create_contact`, `update_contact`, `soft_delete` (hides from list/get, hard_delete still possible), `hard_delete`, auth required, 404, 409 (duplicate wa_id) |
| `tests/test_tags.py` | 8-10 tests | `list_tags`, `create_tag`, `delete_tag`, `delete_tag_in_use_returns_409`, auth required, duplicate name |
| `tests/test_contact_tags.py` | 6-8 tests | `assign_tag`, `assign_duplicate_returns_409`, `remove_tag`, `tags_appear_in_contact_response`, `remove_tag_not_assigned_returns_404` |

**Total new tests:** ~30

### Frontend

- Unit tests via Vitest + RTL for `ContactTable`, `ContactForm`
- Hook test for `useContacts` (mock `apiClient.request`)
- Page-level integration test

---

## 10. Security

| Concern | Mitigation |
|---|---|
| **Authentication** | All endpoints protected by `get_current_user` |
| **SQL Injection** | None — all queries use SQLAlchemy parameterized statements; search uses `ilike()` which is parameterized |
| **Input validation** | Pydantic schemas with `Field(min_length=...)`, `Field(pattern=...)` for hex color |
| **Soft delete bypass** | `hard_delete` also requires auth; same protection level |
| **Tag deletion safety** | RESTRICT prevents accidental data loss |
| **Rate limiting** | Not needed for CRUD (low cost). Login remains rate-limited. |

---

## 11. Performance

| Query | Frequency | Cost |
|---|---|---|
| `SELECT contacts WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 25 OFFSET 0` | Per page load | <5ms (indexed) |
| `SELECT tags JOIN contact_tags WHERE contact_id IN (...)` | Per list load | <3ms (indexed) |
| `INSERT INTO tags` | Rare | <2ms |
| `INSERT INTO contact_tags` | Frequent (tag assignment) | <2ms (unique index check) |

**No performance concerns.** Maximum expected contact volume: low thousands.

---

## 12. Approval Checklist

- [x] F6A integration verified (74/74 tests, 0 type errors)
- [x] No regressions detected
- [x] Data model finalized (contacts extended, tags + bridge table)
- [x] Index strategy defined
- [x] Soft delete pattern documented
- [x] Route design correct (id-based, wa_id as secondary)
- [x] Compatibility with F5 confirmed
- [x] Compatibility with F6A confirmed
- [x] Risks documented and mitigated
- [x] Testing strategy defined
- [x] Security review complete
- [x] Performance review complete
- [x] Implementation ordered as PR B1 (backend) → PR B2 (frontend)

---

## Verdict

**READY FOR IMPLEMENTATION**
