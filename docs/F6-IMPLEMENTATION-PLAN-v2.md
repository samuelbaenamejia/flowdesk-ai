# F6 Implementation Plan v2

> **Status:** Approved after Critical Design Review
> **Total PRs:** 17
> **Target:** Portfolio-ready SaaS quality

---

## Tag Storage: Architectural Decision Record

### Context

Contact tags need to support: filtering by tag, search, statistics, colored tags, global tags, and permission scoping within F6's lifetime (not "someday").

### Options Evaluated

| Criterion | CSV String | ARRAY(Text) | `tags` table (FK to contact) | Bridge: `tags` + `contact_tags` |
|---|---|---|---|---|
| Query by tag | `ILIKE '%tag%'` (full scan) | `ANY(tags)` (GIN index) | JOIN (indexed) | JOIN (indexed) |
| Filter by multiple tags | Impossible efficiently | `@>` operator (native) | Complex HAVING | Simple INTERSECT |
| Tag stats/counts | Full table scan + parse | `unnest` + GIN | `GROUP BY name` | `GROUP BY tags.name` |
| Add color to tag | Migration | Migration | `ALTER TABLE tags ADD COLUMN color` | Already on `tags` table |
| Add global tags | Migration | Migration | `ALTER TABLE tags ADD COLUMN is_global` | Already on `tags` table |
| Add permissions | Impossible | Impossible | `ALTER TABLE tags ADD COLUMN team_id` | Already on `tags` table |
| Normalization | None | None | Partial (tag name duplicated) | Full |
| Query complexity | Trivial | Simple | Moderate | Moderate (3-table JOIN) |
| ORM support | String field | ARRAY column | One-to-many | Many-to-many |

### Decision: Bridge table (`tags` + `contact_tags`)

**Rationale:**

1. The user identified that tags will need colors, global scoping, permissions, and stats within F6's horizon. ARRAY(Text) supports none of these without a second migration.
2. The bridge table is the only option that supports all identified future requirements with zero schema changes.
3. The third option (`tags` table with FK) allows duplicate tag names across contacts and doesn't normalize tag metadata — a middle ground that satisfies neither simplicity nor completeness well.
4. A 3-table JOIN is negligible cost with proper indexes. The `contact_tags` table will remain small even at scale (one row per contact per tag).
5. For a portfolio project, the normalized approach demonstrates architectural maturity.

**Schema:**

```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7),          -- hex color, nullable
    is_global BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX idx_tags_name ON tags(name);  -- global tag names are unique

CREATE TABLE contact_tags (
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT now(),
    PRIMARY KEY (contact_id, tag_id)
);
CREATE INDEX idx_contact_tags_tag_id ON contact_tags(tag_id);
```

**Self-correction vs v1:** v1 proposed ARRAY(Text). This is a better decision and avoids a future migration.

---

## Phase Map

```
F6A ────── F6B ────── F6C ────── F6D ────── F6E ────── F6F ────── F6G
Foundation → Contacts → Profile  → Inbox   → Dash-   → Chat    → Final
                       + Settings  Search    board      Prod.     Audit
```

---

## F6A — Foundation

**Goal:** Build every piece of reusable infrastructure that all subsequent phases depend on. No business features. Only cross-cutting concerns.

**Justification:** Every feature phase needs token auth, pagination, toast feedback, retry logic, error boundaries, and loading/error/empty states. Building these once, before any feature, eliminates duplication and keeps every subsequent PR small.

**Dependencies:** None (root phase).

**Risks:**
- Token refresh must not break existing auth flow (mitigation: backward-compatible, old tokens still work)
- Pagination changes the response format — existing frontend must handle old and new format (mitigation: dual-format response for one release)

**Database changes:**
- Add indexes: `messages.conversation_id`, `messages.timestamp`, `conversations.contact_id`, `contacts.wa_id`

---

### PR 6A.1 — HTTP Client + Token Refresh

**Files:**

| File | Change |
|---|---|
| `backend/app/api/v1/auth.py` | Add `POST /auth/refresh` endpoint |
| `backend/app/core/config.py` | Add `REFRESH_TOKEN_EXPIRE_MINUTES` |
| `backend/app/schemas/auth.py` | Add `TokenRefreshResponse` schema |
| `frontend/src/lib/api.ts` | Create robust API client with 401 interceptor |
| `frontend/src/contexts/AuthContext.tsx` | Add refresh flow, store refresh token |
| `frontend/src/types/index.ts` | Add `TokenRefreshResponse` type |

**Backend:**
- `POST /api/v1/auth/refresh` accepts `{ access_token: string }` (the expired one). If token is valid (just expired), re-issues a new access token. If token is tampered or invalid, returns 401.
- Config: `REFRESH_TOKEN_EXPIRE_MINUTES = 1440` (24h)

**Frontend:**
- `api.ts`: Class-based or factory-based HTTP client. Every request goes through it. On 401, attempt refresh, retry original request once, only logout if refresh also fails.
- `AuthContext.tsx`: Store refresh behavior. `getMe()` retries after refresh.
- Token stored in `localStorage` (same as now, but add `refreshInProgress` flag to prevent race conditions from multiple simultaneous 401s).

**Acceptance criteria:**
1. Existing login/logout flow still works
2. When access token expires, a single API call triggers silent refresh
3. User session continues without interruption
4. If refresh also fails, user is logged out
5. Multiple simultaneous 401s only trigger one refresh request

**Test checklist:**
- Backend: token refresh endpoint returns new token for expired-but-valid tokens
- Backend: token refresh rejects tampered tokens
- Backend: token refresh rejects non-expired tokens (no unnecessary re-issuing)
- Frontend: simulated 401 triggers refresh
- Frontend: refresh failure triggers logout

**Effort:** Medium (~400 lines)

---

### PR 6A.2 — Toast System + Confirm Dialog

**Files:**

| File | Change |
|---|---|
| `frontend/src/components/ui/Toast.tsx` | Create toast component |
| `frontend/src/contexts/ToastContext.tsx` | Create toast context + provider |
| `frontend/src/components/ui/ConfirmDialog.tsx` | Create confirm dialog component |
| `frontend/src/pages/_app.tsx` | Wire ToastProvider |

**Frontend:**
- Toast: auto-dismiss after 4s, stacked vertically, 3 variants (success/error/info), close button, accessible (`role="alert"`, `aria-live="polite"`)
- Toast API: `showToast(message, variant)` via `useToast()` hook
- ConfirmDialog: `confirm({ title, message, confirmLabel, cancelLabel, variant })` returns `Promise<boolean>`. Overlay + centered dialog, focus trap, Escape to cancel, Enter to confirm.
- No third-party library. Pure CSS + React state.

**Acceptance criteria:**
1. `showToast("Saved", "success")` renders a green toast that disappears after 4s
2. Multiple toasts stack
3. `await confirm("Delete?")` returns `true` if user clicks Confirm, `false` if Cancel/Escape
4. ConfirmDialog is keyboard-accessible (Tab, Enter, Escape)

**Test checklist:**
- Toast renders and auto-dismisses
- Toast stack renders multiple toasts
- ConfirmDialog resolves with correct boolean
- ConfirmDialog traps focus
- Escape dismisses ConfirmDialog

**Effort:** Small (~200 lines)

---

### PR 6A.3 — Pagination Infrastructure

**Files:**

| File | Change |
|---|---|
| `backend/app/api/v1/conversations.py` | Add `limit`/`offset` params, wrap response |
| `backend/app/api/v1/contacts.py` | Add `limit`/`offset`/`q` params (prepare for F6B) |
| `backend/app/api/v1/conversations_messages.py` | Add `limit`/`offset` to messages list |
| `backend/app/schemas/common.py` | Add `PaginatedResponse[T]` generic schema |
| `frontend/src/hooks/usePaginatedQuery.ts` | Create reusable paginated query hook |
| `frontend/src/hooks/useConversations.ts` | Refactor to use paginated hook |
| `frontend/src/hooks/useMessages.ts` | Refactor to use paginated hook |

**Backend:**
- New generic schema: `PaginatedResponse[T]` = `{ data: list[T], total: int, limit: int, offset: int }`
- `GET /conversations` accepts `?limit=50&offset=0`. Defaults: limit=50, offset=0. Returns `PaginatedResponse[ConversationResponse]`.
- `GET /contacts` accepts `?limit=50&offset=0&q=`. Returns `PaginatedResponse[ContactResponse]`.
- `GET /conversations/{id}/messages` accepts `?limit=50&offset=0`. Returns `PaginatedResponse[MessageResponse]`.
- **Backward compatibility:** If `Accept: application/json` header is present with old format or no pagination params, include a `Warning` header. Next release removes the old format.

**Frontend:**
- `usePaginatedQuery(fetcher, params)` returns `{ data, total, loading, error, retry, loadMore, hasMore, reset }`
- `useConversations` wraps `usePaginatedQuery`
- `useMessages` wraps `usePaginatedQuery`
- Conversation list shows "Load more" button when `hasMore` is true
- Message list triggers load on scroll-to-top (inverted scroll for chat)

**Acceptance criteria:**
1. `GET /conversations?limit=10&offset=0` returns 10 items with correct total
2. Frontend renders "Load more" when more pages exist
3. Loading state shown during pagination fetch (not full page reload)
4. Existing frontend still works with old format (no pagination params)

**Test checklist:**
- Backend: pagination returns correct subset
- Backend: pagination with offset beyond total returns empty array
- Backend: default limit applied when not specified
- Frontend: loadMore appends to existing data
- Frontend: hasMore is false when data is exhausted
- Frontend: retry works on pagination failure

**Effort:** Large (~450 lines)

---

### PR 6A.4 — Reusable States + Error Boundaries + DB Indexes

**Files:**

| File | Change |
|---|---|
| `frontend/src/components/ui/LoadingSkeleton.tsx` | Create skeleton component |
| `frontend/src/components/ui/EmptyState.tsx` | Create empty state component |
| `frontend/src/components/ui/ErrorState.tsx` | Create error state with retry |
| `frontend/src/components/ui/PageErrorBoundary.tsx` | Create page-level error boundary |
| `frontend/src/pages/_app.tsx` | Add PageErrorBoundary per page |
| `frontend/src/pages/conversations/index.tsx` | Wire Loading/Empty/Error states |
| `frontend/src/pages/conversations/[id].tsx` | Wire Loading/Empty/Error states |
| `frontend/src/pages/login.tsx` | Wire error state |
| _(migration)_ | Add DB indexes |

**Frontend:**
- `LoadingSkeleton`: Variants: `line`, `card`, `avatar`, `chart`. Accept `count` and `variant`. Pure CSS shimmer animation.
- `EmptyState`: Accept `icon`, `title`, `description`, `action` (optional button). Centered layout with muted text.
- `ErrorState`: Accept `message` and `onRetry`. Shows error icon + message + "Try again" button.
- `PageErrorBoundary`: Catches errors from a single page. Renders `ErrorState` with retry that re-mounts page. Does NOT catch async errors in hooks (handled by `ErrorState` component manually).
- All three used in conversation list + conversation detail + login pages.

**Backend:**
- Migration: `CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);`
- Migration: `CREATE INDEX idx_messages_timestamp ON messages(timestamp);`
- Migration: `CREATE INDEX idx_conversations_contact_id ON conversations(contact_id);`
- Migration: `CREATE UNIQUE INDEX idx_contacts_wa_id ON contacts(wa_id);`

**Acceptance criteria:**
1. Conversation list shows skeleton while loading, empty state when zero, error state with retry on failure
2. Conversation detail shows skeleton while loading, error state with retry on failure
3. `PageErrorBoundary` catches render errors and shows retry button
4. Global `ErrorBoundary` still exists as last resort
5. DB indexes are created (no data loss)

**Test checklist:**
- Backend: migration runs cleanly on empty DB and on existing data
- Frontend: LoadingSkeleton renders shimmer animation
- Frontend: EmptyState renders icon + message
- Frontend: ErrorState renders message + retry button, retry calls callback
- Frontend: PageErrorBoundary catches error and retry re-mounts children

**Effort:** Medium (~350 lines)

---

## F6B — Contacts

**Goal:** Full contact management with typed tags, search, and sidebar integration.

**Justification:** Contacts are the second most important entity after conversations. Without contact management, every conversation shows "Unknown" with no way to enrich customer data.

**Dependencies:** F6A (pagination, toast, retry, error boundaries, loading/empty states).

**Database changes:**
- Create `tags` table
- Create `contact_tags` table
- Remove `contacts.tags` (CSV string) column
- Remove `contacts.deleted_at` column
- Add columns: `contacts.email`, `contacts.company`, `contacts.notes`, `contacts.is_important`

**Risks:**
- Migration from CSV tags to bridge table must handle existing data
- Removing `deleted_at`: if any rows have `deleted_at IS NOT NULL`, those contacts vanish (acceptable — no UI ever showed them)

---

### PR 6B.1 — Migration + Models + Schemas

**Files:**

| File | Change |
|---|---|
| `backend/app/models/contact.py` | Remove `deleted_at`, remove `tags`, add `email`, `company`, `notes`, `is_important` |
| `backend/app/models/tag.py` | New model: `Tag` (id, name, color, is_global, created_by, created_at) |
| `backend/app/models/contact_tag.py` | New model: `ContactTag` (contact_id, tag_id, assigned_at) |
| `backend/app/models/__init__.py` | Export new models |
| `backend/app/schemas/contact.py` | Add `ContactCreate`, expand `ContactResponse` with new fields + tags |
| `backend/app/schemas/tag.py` | New file: `TagCreate`, `TagResponse`, `TagUpdate` |
| _(migration)_ | Create tables, migrate data, drop old columns |

**Backend:**
- `Contact` model: remove `deleted_at` and `tags` (CSV). Add `email: Optional[str]`, `company: Optional[str]`, `notes: Optional[str]`, `is_important: bool = False`.
- `Tag` model: `id (UUID PK)`, `name (str, max 50)`, `color (str, optional, hex)`, `is_global (bool, default false)`, `created_by (UUID FK to users)`, `created_at (timestamp)`.
- `ContactTag` model: `contact_id (UUID FK)`, `tag_id (UUID FK)`, `assigned_at (timestamp)`. Composite PK. Cascade delete on contact_id.
- Migration steps: (1) Create `tags` and `contact_tags` tables. (2) Parse existing `contacts.tags` CSV values, create tags, insert into `contact_tags`. (3) Remove `contacts.tags` column. (4) Remove `contacts.deleted_at` column. (5) Add `email`, `company`, `notes`, `is_important` columns.
- Schemas: `ContactCreate` (name, wa_id required; email, company, notes, is_important, tag_ids optional). `ContactResponse` now includes `tags: list[TagResponse]`.

**Acceptance criteria:**
1. Migration runs without data loss
2. Existing contacts with CSV tags have their tags migrated to `contact_tags`
3. New models are importable and pass type checks
4. Schemas serialize/deserialize correctly

**Test checklist:**
- Migration on empty DB: creates tables, no errors
- Migration on DB with CSV tags: tags are migrated correctly
- Migration rollback (if needed): restores old columns and CSV data
- Model tests: create Contact with tags, verify relationships
- Schema tests: `ContactCreate` validates required fields

**Effort:** Medium (~350 lines)

---

### PR 6B.2 — Contact Endpoints + Tests

**Files:**

| File | Change |
|---|---|
| `backend/app/services/contact_service.py` | New service layer for contact operations |
| `backend/app/api/v1/contacts.py` | Rewrite: add list/create/delete, expand update |
| `backend/app/api/v1/tags.py` | New router: CRUD for tags |
| `backend/app/api/v1/__init__.py` | Register new routers |
| `backend/tests/test_contacts.py` | Expand tests |
| `backend/tests/test_tags.py` | New test file |

**Backend:**
- `ContactService` class: `list(pagination, q, tag_ids)`, `get_by_wa_id(wa_id)`, `create(data)`, `update(wa_id, data)`, `delete(wa_id)`.
- `GET /api/v1/contacts` — paginated, search by q (name/wa_id/email), filter by `tag_id` (comma-separated).
- `POST /api/v1/contacts` — create contact. Auto-create tags if tag_ids reference non-existent tags? No — tag_ids must reference existing tags.
- `PATCH /api/v1/contacts/{wa_id}` — update fields and/or tag_ids.
- `DELETE /api/v1/contacts/{wa_id}` — hard delete (since soft-delete was removed).
- `GET /api/v1/tags` — list all tags (global + user-created).
- `POST /api/v1/tags` — create tag.
- `PATCH /api/v1/tags/{id}` — update tag name/color.
- `DELETE /api/v1/tags/{id}` — delete tag (removes from all contacts via FK cascade).

**Acceptance criteria:**
1. Full CRUD for contacts works
2. Search contacts by name, wa_id, email
3. Filter contacts by tag(s)
4. Full CRUD for tags works
5. Deleting a tag removes it from all contacts
6. All endpoints require auth
7. All endpoints return proper errors (404, 422, 409)

**Test checklist:**
- Create contact, get by wa_id, update, delete
- Create contact with tags, verify tags in response
- Search contacts with query string
- Filter contacts by tag_id
- Create tag, update, delete
- Delete tag used by contacts (verify cascade)
- Auth required for all endpoints
- 404 for non-existent contact/tag
- 422 for invalid data

**Effort:** Large (~500 lines)

---

### PR 6B.3 — Contacts Frontend

**Files:**

| File | Change |
|---|---|
| `frontend/src/pages/contacts/index.tsx` | New page: contact list with search |
| `frontend/src/pages/contacts/[wa_id].tsx` | New page: contact detail/edit |
| `frontend/src/hooks/useContacts.ts` | New hook |
| `frontend/src/hooks/useTags.ts` | New hook |
| `frontend/src/components/layout/Sidebar.tsx` | Add "Contactos" link |
| `frontend/src/types/index.ts` | Add contact + tag types |

**Frontend:**
- `/contacts` page:
  - Search bar (debounced, searches name/wa_id/email)
  - Filter chips for tags
  - Paginated list with "Load more"
  - Each row: avatar placeholder + name + wa_id + tag badges (colored)
  - Loading: skeleton list (5 rows)
  - Empty: "No contacts yet" + "Create first contact" button
  - Error: error state with retry
- `/contacts/[wa_id]` page:
  - Editable form: name, wa_id (read-only after creation), email, company, notes, is_important toggle
  - Tag selector: dropdown/combobox with existing tags + option to create new tag inline
  - Save button with toast feedback
  - Delete button with ConfirmDialog
  - Loading: skeleton form
  - Error: error state with retry
  - 404: dedicated "Contact not found" state
- `useContacts` hook: `{ contacts, total, loading, error, retry, loadMore, hasMore, search, filterByTag }`
- `useTags` hook: `{ tags, loading, createTag, deleteTag }`

**Acceptance criteria:**
1. Contact list renders with search and tag filter
2. Create contact via form + toast success
3. Edit contact via form + toast success
4. Delete contact via ConfirmDialog + toast success
5. Loading skeleton, empty state, error state all render correctly
6. Sidebar links to /contacts

**Test checklist:**
- Contact list loads and displays contacts
- Search filters contacts in real time (debounced)
- Tag filter limits results
- Create flow: fill form → submit → toast → redirect to detail
- Edit flow: change fields → save → toast → updated data
- Delete flow: click delete → confirm → toast → redirect to list
- Loading skeleton renders while fetching
- Empty state renders when no contacts
- Error state renders with retry on API failure

**Effort:** Large (~500 lines)

---

### PR 6B.4 — Contact Sidebar Panel

**Files:**

| File | Change |
|---|---|
| `frontend/src/components/contacts/ContactPanel.tsx` | New: side panel in conversation view |
| `frontend/src/pages/conversations/[id].tsx` | Add contact panel (right side) |

**Frontend:**
- `ContactPanel` component: shows contact name, wa_id, email, company, tag badges, "View full profile" link
- Quick-edit: inline name edit, inline tag add/remove
- Opens as a right sidebar in conversation view (desktop) or bottom sheet (mobile)
- Toggle button in conversation header to show/hide panel
- Loading: skeleton for panel
- Error: error state with retry

**Acceptance criteria:**
1. Contact panel shows in conversation view
2. Quick-edit name saves with toast
3. Quick tag add/remove works
4. "View full profile" navigates to `/contacts/[wa_id]`
5. Panel is toggleable (show/hide)
6. Responsive: sidebar on desktop, bottom sheet on mobile

**Effort:** Medium (~300 lines)

---

## F6C — Profile + Settings

**Goal:** User profile management and business configuration (business hours, canned responses).

**Justification:** The app currently has no user settings or profile page. Business hours and canned responses are essential for a professional WhatsApp business tool.

**Dependencies:** F6A (toast, error boundaries, loading states).

**Database changes:**
- `CannedResponse.created_by` type: `INT → UUID` (migration)

**Risks:**
- `CannedResponse.created_by` type migration fails if FK values don't match UUID format (mitigation: DB may already store UUIDs as strings — verify before migration)

---

### PR 6C.1 — Profile Page

**Files:**

| File | Change |
|---|---|
| `backend/app/api/v1/profile.py` | New router |
| `backend/app/schemas/profile.py` | New schemas |
| `backend/app/api/v1/__init__.py` | Register profile router |
| `frontend/src/pages/profile/index.tsx` | New page |
| `frontend/src/hooks/useProfile.ts` | New hook |
| `frontend/src/components/layout/Sidebar.tsx` | Add "Perfil" link |

**Backend:**
- `GET /api/v1/profile` — returns current user's profile (name, email, avatar_url, created_at)
- `PATCH /api/v1/profile` — update name, avatar_url
- `POST /api/v1/profile/avatar` — upload avatar image (stored as static file or returned as URL)
- Schema: `ProfileResponse`, `ProfileUpdate`
- Service: `ProfileService`

**Frontend:**
- `/profile` page:
  - Avatar upload with preview (click to upload, drag-and-drop optional)
  - Name input
  - Email (read-only)
  - Member since date
  - Save button with toast
  - Loading: skeleton form
  - Error: error state with retry
- No password change in F6 (add to F7)

**Acceptance criteria:**
1. Profile page displays current user info
2. Avatar upload works with preview
3. Name update works with toast feedback
4. Sidebar links to /profile

**Effort:** Medium (~350 lines)

---

### PR 6C.2 — Business Settings + Canned Responses

**Files:**

| File | Change |
|---|---|
| `backend/app/models/canned_response.py` | Fix `created_by` type (INT → UUID) |
| `backend/app/api/v1/settings.py` | New router |
| `backend/app/api/v1/canned_responses.py` | New router |
| `backend/app/schemas/settings.py` | New schemas |
| `backend/app/schemas/canned_response.py` | New schemas |
| `backend/app/api/v1/__init__.py` | Register new routers |
| `backend/app/core/config.py` | Add settings-related config |
| `frontend/src/pages/settings/index.tsx` | New page |
| `frontend/src/hooks/useSettings.ts` | New hook |
| `frontend/src/hooks/useCannedResponses.ts` | New hook |
| `frontend/src/components/layout/Sidebar.tsx` | Add "Configuración" link |

**Backend:**
- `GET /api/v1/settings` — returns business hours, greeting message, timezone
- `PATCH /api/v1/settings` — update settings
- `GET /api/v1/canned-responses` — list user's canned responses
- `POST /api/v1/canned-responses` — create new
- `PATCH /api/v1/canned-responses/{id}` — update
- `DELETE /api/v1/canned-responses/{id}` — delete
- Migration: `ALTER TABLE canned_responses ALTER COLUMN created_by TYPE UUID USING created_by::uuid;`
- Schemas: `SettingsResponse`, `SettingsUpdate`, `CannedResponseCreate`, `CannedResponseUpdate`, `CannedResponseResponse`

**Frontend:**
- `/settings` page with two sections:
  - Business hours: day-of-week checkboxes + time pickers (open/close)
  - Greeting message: textarea
  - Save button with toast
- Canned responses section on `/settings` or standalone:
  - List with search
  - Create: shortcut key + message text
  - Edit inline or modal
  - Delete with ConfirmDialog
  - Empty: "No canned responses yet"
- Loading, error, empty states for both sections

**Acceptance criteria:**
1. Business hours can be set and saved with toast
2. Canned responses can be created, edited, and deleted
3. Canned response uses UUID for created_by (migration)
4. All states (loading, error, empty) render correctly
5. Sidebar links to /settings

**Effort:** Large (~500 lines)

---

## F6D — Inbox Search

**Goal:** Search conversations by contact name, wa_id, and message content.

**Justification:** As the conversation count grows, finding a specific conversation becomes impossible without search. This is a core productivity feature.

**Dependencies:** F6A (pagination), F6B (contact search).

**Database changes:**
- Add trigram index for ILIKE search performance

**Risks:**
- Full-text search on messages could be slow without proper indexing (mitigation: use `pg_trgm` extension + `ILIKE` with limit)

---

### PR 6D.1 — Search API

**Files:**

| File | Change |
|---|---|
| `backend/app/api/v1/conversations.py` | Add `?q=` search param |
| `backend/app/services/conversation_service.py` | Add search logic with ILIKE |
| `backend/app/schemas/conversation.py` | Add search result schema |
| _(migration)_ | Enable `pg_trgm` extension, add GIN indexes |

**Backend:**
- `GET /api/v1/conversations?q=term` — searches across:
  - `contact.name ILIKE '%term%'`
  - `contact.wa_id ILIKE '%term%'`
  - Message content in the conversation matching `ILIKE '%term%'` (last matching message)
- Returns paginated conversations with a `snippet` field showing the matching message preview
- Limit search results to 50 max (performance)
- Migration: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + GIN indexes on `contacts.name`, `contacts.wa_id`

**Acceptance criteria:**
1. `?q=john` returns conversations where contact name matches
2. `?q=123456` returns conversations where wa_id matches
3. Search results include message snippet when match is in message content
4. Search works with pagination
5. Empty query returns all conversations (no filtering)
6. Search is case-insensitive

**Test checklist:**
- Search by contact name
- Search by wa_id
- Search by message content
- Search with no results returns empty array
- Search + pagination works together
- Empty q param returns unfiltered results
- Auth required

**Effort:** Medium (~300 lines)

---

### PR 6D.2 — Search Frontend UI

**Files:**

| File | Change |
|---|---|
| `frontend/src/pages/conversations/index.tsx` | Add search bar + search mode |
| `frontend/src/hooks/useConversations.ts` | Add search functionality |
| `frontend/src/components/conversations/SearchBar.tsx` | New: search input with debounce |

**Frontend:**
- Search bar at top of conversation list (replaces filter area)
- Debounced input (300ms) — as user types, results update
- When search has results: show conversation list with match snippets highlighted
- When search has no results: "No conversations match your search" (empty state variant)
- When search is empty: show normal conversation list
- Search state persists in URL (`?q=term`) so it survives page refresh and is shareable
- Loading state: spinner in search bar (subtle)
- Error state: inline error below search bar with retry button

**Acceptance criteria:**
1. Typing in search bar filters conversations in real time (debounced)
2. Matching text is highlighted in results
3. Empty results show "No conversations match your search"
4. Search param is in URL
5. Clearing search returns to full list
6. Loading spinner appears during search
7. Error shows inline with retry

**Effort:** Medium (~300 lines)

---

## F6E — Dashboard

**Goal:** Business intelligence dashboard with key metrics and charts.

**Justification:** Dashboard vende el producto. Es la primera página que ve un usuario al abrir la app y debe mostrar el valor de inmediato. Además, los datos ya existen (conversaciones y mensajes) — no espera a nuevas features.

**Dependencies:** F6A (error boundaries, skeletons, pagination hook for "recent conversations").

**Risks:**
- Aggregate queries could be slow on large datasets (mitigation: limit date range to 30 days, add indexes, consider caching if slow)

---

### PR 6E.1 — Dashboard API

**Files:**

| File | Change |
|---|---|
| `backend/app/api/v1/dashboard.py` | New router |
| `backend/app/services/dashboard_service.py` | New service |
| `backend/app/schemas/dashboard.py` | New schemas |
| `backend/app/api/v1/__init__.py` | Register dashboard router |

**Backend:**
- `GET /api/v1/dashboard/stats` returns:
  - `total_conversations: int`
  - `messages_today: int`
  - `messages_this_week: int`
  - `response_rate: float` (percentage of conversations with ≥1 agent message)
  - `avg_response_time_minutes: float`
  - `top_contacts: list[{wa_id, name, message_count}]` (top 5)
- `GET /api/v1/dashboard/messages-over-time` returns:
  - `data: list[{date: str, count: int}]` — last 30 days, one entry per day
- All queries scoped to the authenticated user's organization/account
- Queries use existing indexes (`messages.timestamp`) and are limited to last 30 days
- No caching in F6 (add in F7 if needed)

**Acceptance criteria:**
1. Stats endpoint returns correct numbers (verify against raw data)
2. Messages-over-time returns 30 data points
3. Response rate is calculated correctly
4. Top contacts are ordered by message count
5. Endpoints return quickly (<500ms on 10k conversations)
6. Auth required

**Test checklist:**
- Stats endpoint with 0 conversations returns zeros/empty
- Stats endpoint with known data returns correct counts
- Response rate calculation is correct
- Messages-over-time returns correct daily counts
- Messages-over-time with missing days returns 0 for those days
- Auth required
- Performance test with large dataset

**Effort:** Medium (~350 lines)

---

### PR 6E.2 — Dashboard Frontend

**Files:**

| File | Change |
|---|---|
| `frontend/src/pages/dashboard/index.tsx` | New page (new default landing page) |
| `frontend/src/hooks/useDashboard.ts` | New hook |
| `frontend/src/components/dashboard/StatCard.tsx` | New component |
| `frontend/src/components/dashboard/MessagesChart.tsx` | New component (SVG-based chart) |
| `frontend/src/components/layout/Sidebar.tsx` | Add "Dashboard" link as first item |
| `frontend/src/pages/_app.tsx` | Redirect `/` to `/dashboard` |

**Frontend:**
- `/dashboard` page layout:

```
┌─────────────────────────────────────────────┐
│  Dashboard                                   │
│                                              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐│
│  │ 245   │  │ 1,204 │  │  92%  │  │  3.2min  ││
│  │ Conv. │  │ Msgs  │  │ Resp. │  │ Avg resp ││
│  │ total │  │ today │  │ rate  │  │  time    ││
│  └──────┘  └──────┘  └──────┘  └──────────┘│
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │  Messages over time                   │   │
│  │  (SVG line chart, last 30 days)       │   │
│  └───────────────────────────────────────┘   │
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │  Recent conversations                  │   │
│  │  (last 5, with contact + snippet)      │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

- Stat cards: 4 in a responsive grid. Each shows number + label + trend indicator (optional). Each card is independently loading/error (one failing API doesn't break others).
- Chart: SVG-based line chart. No third-party library for F6 (build a minimal one). X-axis: dates. Y-axis: message count. Tooltip on hover.
- Recent conversations: list of last 5 conversations using the existing conversation list item component. Links to `/conversations/[id]`.
- Loading: 4 skeleton stat cards + skeleton chart + skeleton list
- Error: per-card error with retry for stats, full error for chart + list
- Empty: all zeros state with "Start by adding contacts" CTA

**Acceptance criteria:**
1. Dashboard loads as default page (`/` redirects to `/dashboard`)
2. 4 stat cards display correct numbers with loading skeletons
3. Chart renders SVG line with last 30 days of data
4. Recent conversations list links to conversation view
5. Per-card error handling (one failing stat doesn't break others)
6. All states (loading, error, empty) render correctly
7. Sidebar has Dashboard as first link

**Effort:** Large (~500 lines)

---

## F6F — Chat Productivity

**Goal:** Better messaging experience: message search, date grouping, smooth scrolling, unread indicators.

**Justification:** The chat view is the most-used screen. Small UX improvements here have the highest impact on daily user satisfaction.

**Dependencies:** F6A (pagination, toast, error boundaries), F6D (inbox search).

---

### PR 6F.1 — Message Search + Date Grouping

**Files:**

| File | Change |
|---|---|
| `backend/app/api/v1/conversations_messages.py` | Add search within conversation |
| `frontend/src/pages/conversations/[id].tsx` | Add search bar + date headers |
| `frontend/src/hooks/useMessages.ts` | Add search functionality |
| `frontend/src/components/conversations/MessageSearch.tsx` | New component |
| `frontend/src/components/conversations/DateGroup.tsx` | New component |

**Backend:**
- `GET /api/v1/conversations/{id}/search?q=term` — search messages within a conversation. Returns messages with matching content, ordered by timestamp desc. Limited to 50 results.

**Frontend:**
- Message search bar inside conversation view (toggleable, Ctrl+F to open)
- Search results: messages highlighted with matching text
- Close search: Escape or click X
- Date grouping: Messages grouped by date with sticky headers ("Today", "Yesterday", "Monday", "Jul 20", etc.)
- Group header shows full date on first occurrence, relative after that

**Acceptance criteria:**
1. Ctrl+F opens message search bar
2. Typing searches messages in the conversation (API call)
3. Matching text is highlighted in results
4. Close search returns to normal view
5. Messages are grouped by date with correct headers
6. Date groups collapse/expand

**Effort:** Medium (~400 lines)

---

### PR 6F.2 — Scroll Behavior + Unread Markers

**Files:**

| File | Change |
|---|---|
| `frontend/src/pages/conversations/[id].tsx` | Add scroll-to-bottom, unread markers |
| `frontend/src/components/conversations/FloatingScrollButton.tsx` | New component |
| `frontend/src/hooks/useConversations.ts` | Track unread count |

**Frontend:**
- Auto-scroll to bottom when opening a conversation (if viewing latest messages)
- Floating scroll-to-bottom button (FAB): appears when user scrolls up, disappears at bottom. Badge with new message count.
- Unread indicator: dot on conversation in list when there are unread messages
- Read receipt: mark conversation as read when opened
- Keyboard shortcuts: Ctrl+Enter to send, Ctrl+F for search, Escape to close search

**Acceptance criteria:**
1. Opening a conversation scrolls to bottom
2. Scrolling up shows floating "Scroll to bottom" button with unread count
3. Clicking the button scrolls to bottom smoothly
4. Unread dot appears on conversation list items
5. Opening a conversation clears its unread status
6. Ctrl+Enter sends message
7. Ctrl+F opens search
8. Escape closes search

**Effort:** Medium (~350 lines)

---

## F6G — Final Audit

**Goal:** One lightweight pass to catch everything that slipped through.

**Justification:** Polish per phase prevents accumulation, but a final pass catches edge cases and inconsistencies across phases.

**Dependencies:** All previous phases complete.

---

### PR 6G.1 — UX + Consistency Audit

**Files:** Any file that fails the audit criteria.

**Checklist (apply to every page/screen in the app):**

| Criterion | Detail |
|---|---|
| Loading skeleton | Renders while data is fetching. Matches page layout. |
| Error state | Shows error message + "Try again" button. Retry re-fetches. |
| Empty state | Shows icon + title + description + optional CTA button. |
| Toast feedback | All mutations (create, update, delete) show success toast. All failures show error toast. |
| Confirm dialog | All destructive actions show confirm before executing. |
| Keyboard navigation | Tab order follows visual order. All interactive elements are focusable. Enter/Space activates. Escape closes modals/dialogs. |
| Responsive | Layout works at 375px, 768px, 1280px. No horizontal scroll. Text is readable. |
| Dark mode | All new components respect `dark:` classes. No hardcoded light colors. |
| Accessibility | All icons have `aria-hidden="true"` or `aria-label`. All form inputs have associated labels. Color contrast ≥ 4.5:1. Focus indicators visible. |
| Hover states | All clickable elements have hover styles. All links have hover underline. |
| Active states | All buttons have active/pressed state. |
| Page title | Each page has a unique `<title>`. |
| URL structure | URLs are consistent (plural, kebab-case). No broken links. |
| Loading spinners | Inline loading (pagination, search) shows subtle spinner, not full-page skeleton. |

**Acceptance criteria:**
1. All checklist items pass for every page
2. No regressions in existing functionality
3. Lighthouse accessibility score ≥ 90

**Effort:** Small (~200–300 lines of fixes across files)

---

## F7 (Deferred)

Features explicitly removed from F6:

| Feature | Reason | Suggested F7 phase |
|---|---|---|
| Export (CSV/PDF) | Low value, no user demand yet | F7A |
| Password change | Security feature, needs email verification flow | F7B |
| Web notifications | Requires service worker, PWA setup | F7C |
| Bulk operations | Requires selection UI, complex UX | F7D |
| Audit log | Enterprise feature | F7E |
| Team/agents | Multi-user, requires RBAC | F7F |

---

## Dependency Graph

```
F6A ──┬── F6B ──┬── F6D ──┬── F6F
      │         │         │
      ├── F6C ──┘         │
      │                   │
      ├───────────────────┤
      │                   │
      ├── F6E ────────────┤
      │                   │
      └───────────────────┴── F6G
```

- **Hard dependencies** (must complete before start):
  - F6B ← F6A
  - F6C ← F6A
  - F6D ← F6A + F6B
  - F6E ← F6A
  - F6F ← F6A + F6D
  - F6G ← everything

- **Soft dependencies** (recommended but not required):
  - F6D ← F6B (contact search makes inbox search richer, but F6D can work without it)
  - F6F ← F6D (message search depends on backend endpoint from F6D)

- **Parallelizable:**
  - F6B ∥ F6C ∥ F6E (after F6A completes)
  - F6D ∥ F6E (after F6B completes)

---

## PR Summary

| PR | Phase | Name | Est. Lines | Dependencies |
|---|---|---|---|---|
| 1 | F6A | HTTP Client + Token Refresh | ~400 | None |
| 2 | F6A | Toast System + Confirm Dialog | ~200 | PR1 |
| 3 | F6A | Pagination Infrastructure | ~450 | PR1 |
| 4 | F6A | Reusable States + Error Boundaries + DB Indexes | ~350 | PR2, PR3 |
| 5 | F6B | Migration + Models + Schemas | ~350 | PR4 |
| 6 | F6B | Contact Endpoints + Tests | ~500 | PR5 |
| 7 | F6B | Contacts Frontend | ~500 | PR6 |
| 8 | F6B | Contact Sidebar Panel | ~300 | PR7 |
| 9 | F6C | Profile Page | ~350 | PR4 |
| 10 | F6C | Business Settings + Canned Responses | ~500 | PR9 |
| 11 | F6D | Search API | ~300 | PR4, PR6 |
| 12 | F6D | Search Frontend UI | ~300 | PR11 |
| 13 | F6E | Dashboard API | ~350 | PR4 |
| 14 | F6E | Dashboard Frontend | ~500 | PR13 |
| 15 | F6F | Message Search + Date Grouping | ~400 | PR4, PR11 |
| 16 | F6F | Scroll Behavior + Unread Markers | ~350 | PR15 |
| 17 | F6G | UX + Consistency Audit | ~300 | All above |

**Total: ~6,500 lines across 17 PRs**

---

## Execution Strategy

1. **Start with F6A PR1 (Token Refresh).** It changes the most sensitive code (auth) and needs the most testing time. Everything else depends on it being rock-solid.

2. **After F6A, parallelize:**
   - One dev (or stream) takes F6B (Contacts)
   - Another takes F6C (Profile + Settings)
   - A third takes F6E (Dashboard, backend-first)
   - F6D waits for F6B to complete

3. **Each PR is mergeable independently.** No PR depends on unmerged code from another PR within the same phase. If F6B PR6 (endpoints) is delayed, PR7 (frontend) is also blocked — keep PRs small to avoid this.

4. **Test before merge.** Every PR must pass existing tests, add new tests for new functionality, and must not break the dev environment.

5. **Backward compatibility.** No PR should break the running app. Use dual-format responses during migration (pagination, tags).

6. **No mega-PRs.** If a PR exceeds ~500 lines, split it further. Developer discipline > tooling.
