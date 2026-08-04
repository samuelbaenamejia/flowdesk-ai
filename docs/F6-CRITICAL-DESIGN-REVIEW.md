# F6 Critical Design Review

## Overview

Review conducted against the existing codebase at commit ~F5. All findings are grounded in actual code, not assumptions. The proposed F6 phases (F6A–F6G) were evaluated for architecture, scalability, UX, maintainability, security, consistency, tech debt, and ordering.

---

## 1. Architecture & Consistency Issues

### 1.1 Backend-diverges-from-documented-patterns

The codebase claims controller→service layers, but:

| Component | Claimed | Actual |
|---|---|---|
| `conversations.py` | Service layer | Inline DB logic in router |
| `messages.py` | Service layer | Inline DB logic in router |
| `contacts.py` | Service layer | Inline DB logic in router |
| `webhooks.py` | Service layer | Uses `MessageService` (correct) |

**Recommendation:** Do NOT refactor existing endpoints in F6 (that is tech debt for F7). But ALL **new** F6 endpoints MUST use a proper service layer to stop the divergence from growing.

### 1.2 Tags-as-CSV-string

`backend/app/models/contact.py` line 18:
```python
tags: Mapped[Optional[str]]  # stored as comma-separated
```

This is unqueryable at scale. Filtering contacts by tag requires a `LIKE '%tag%'` scan. F6A (Contact Management) adds tag filtering as a feature—building it on top of CSV strings is wrong.

**Fix:** Use `ARRAY(Text)` (PostgreSQL native). This is a schema migration, not just a code change.

**Affects:** F6A

### 1.3 Soft-delete overengineering

`Contact.deleted_at` exists with zero queries using `is_deleted` or `deleted_at` filtering. No restore endpoint exists. No UI mentions deleted contacts.

**Assessment:** Premature. Soft-delete adds `WHERE deleted_at IS NULL` to every query for no current benefit.

**Recommendation:** Remove the field in F6A migration. If soft-delete is needed later, it should be a deliberate cross-model pattern, not a single orphan column.

**Affects:** F6A

### 1.4 CannedResponse.created_by-type-mismatch

`backend/app/models/canned_response.py`:
```python
created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
```

But `User.id` is:

```python
id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
```

This is a type mismatch that only works because SQLAlchemy does not enforce Python types at the DB level—but it will break if the FK is enforced. The column should be `UUID` to match `users.id`.

**Fix:** Change `created_by` to `UUID` + `ForeignKey("users.id")`.

**Affects:** F6D

### 1.5 Missing DB indexes

Current indexes (by inspection of models):

| Table | Current indexes | Needed for F6 |
|---|---|---|
| `contacts` | PK only | `wa_id` (unique, already queried by wa_id), `tags` (if GIN on array) |
| `messages` | PK only | `conversation_id` (FK join), `timestamp` (ordering), `sender` (filtering by direction) |
| `conversations` | PK only | `contact_id` (FK join), `last_message_at` (ordering inbox) |

**Recommendation:** Add these indexes as part of the migration in the phase that first touches each table.

**Affects:** F6A (contacts), F6D (messages), F6B (conversations)

---

## 2. UX & Frontend Issues

### 2.1 No loading states (any page)

Zero `loading` UI across the entire frontend. Every page renders nothing while fetching, or worse, renders a flash of empty state.

**Evidence:**

- `frontend/src/pages/conversations/index.tsx`: renders list immediately—no skeleton
- `frontend/src/pages/conversations/[id].tsx`: renders chat view immediately—no skeleton
- `frontend/src/pages/login.tsx`: renders form immediately—fine for login, but no submit feedback

**Recommendation:** Every F6 phase MUST include loading skeletons for its pages. Make this a checklist item per phase, not a separate "Visual Polish" phase.

### 2.2 Single-global-ErrorBoundary

`frontend/src/pages/_app.tsx` line 14:
```tsx
<ErrorBoundary>
  <Component {...pageProps} />
</ErrorBoundary>
```

One error in any page kills the entire app and shows a blank white screen.

**Recommendation:** Each page should have its own error boundary with a "Try again" button. The global boundary should be a last resort only.

**Affects:** All phases. Should be done in the first phase that touches each page.

### 2.3 No retry-logic-in-hooks

`frontend/src/hooks/useConversations.ts`:
```ts
const response = await fetch(`${API_URL}/conversations`, { headers });
const data = await response.json();
```

No `try/catch`, no retry, no error state exposed to the component. A network hiccup = blank page.

**Recommendation:** Each hook needs a `{ data, loading, error, retry }` return shape. `error` must be rendered, and `retry` must be wired to a button.

**Affects:** All existing hooks. Fix the pattern once (in F6A as a base investment), then reuse.

### 2.4 No-empty-state

Conversation list with no conversations renders nothing. No "No conversations yet" message.

**Recommendation:** Empty state component with illustration and clear message.

**Affects:** F6E (Dashboard) could be first to trigger this, but should be done earlier.

### 2.5 No-toast-notification-system

There is no feedback mechanism for user actions anywhere. Creating a contact, sending a message, updating settings—all happen silently with no success/failure indication.

**Recommendation:** Add a toast system (small, library-free, CSS-only) in F6A. Use it in every subsequent phase.

### 2.6 Sidebar-is-sparse

`frontend/src/components/layout/Sidebar.tsx` has exactly 1 nav item: "Conversaciones". No contacts, no settings, no dashboard.

**Recommendation:** Each F6 phase that adds a new page MUST add its nav item to the sidebar.

---

## 3. Security Issues

### 3.1 No-token-refresh

JWT tokens expire (default 30 min from `backend/app/core/config.py` line 20). When they expire:

1. The API returns 401
2. The frontend receives the error
3. `getMe()` fails
4. The user is logged out immediately

There is no refresh token, no silent refresh, no 401 interceptor that retries with a refresh.

**Evidence:** `AuthContext.tsx` line 33: `getMe(storedToken)` — no retry, no refresh.

**Recommendation:** This is a P1 issue. Add a `/auth/refresh` endpoint and a 401 interceptor in the API client. Must be done before any phase that adds new endpoints, otherwise new features will feel broken.

**Affects:** All phases. Should be F6A prerequisite.

### 3.2 No-rate-limiting

No rate limiting on any endpoint. A brute force attack on `/auth/login` or `/api/v1/contacts` is unmitigated.

**Recommendation:** Add `slowapi` or similar. Minimal effort, large security win.

**Affects:** All phases. Do once in F6A.

---

## 4. Scaling Issues

### 4.1 No-pagination-on-conversations

`GET /api/v1/conversations` returns ALL conversations in one response. With 10,000 conversations, this endpoint returns megabytes of JSON and takes seconds to serialize.

**Recommendation:** Add `?limit=50&offset=0` query params. Return `{ data, total, limit, offset }`. The frontend needs infinite scroll or a "Load more" button.

**Affects:** F6B (Inbox Search) depends on this. Should be done in F6A or before.

### 4.2 No-search-on-conversations

`GET /api/v1/conversations` supports no `?q=` param. F6B's "Inbox Search" feature requires this.

**Recommendation:** Add string search over `contact.name`, `contact.wa_id`, and last message content. Use `ILIKE` with a trigram index for performance.

**Affects:** F6B directly.

### 4.3 No-pagination-on-messages

`GET /api/v1/conversations/{id}/messages` returns ALL messages. A busy WhatsApp conversation can have thousands of messages.

**Recommendation:** Same pagination pattern as conversations. Frontend should load more on scroll-to-top (inverted scroll).

**Affects:** F6D (Chat Productivity) needs this for large conversations.

---

## 5. Ordering & Phase Restructuring

### Current Proposed Order

F6A (Contacts) → F6B (Inbox Search) → F6C (Profile & Settings) → F6D (Chat Productivity) → F6E (Dashboard & KPIs) → F6F (Visual Polish) → F6G (Export)

### Problems

1. **F6E (Dashboard) is too late.** The app already has conversations generating data. A basic dashboard gives immediate value and should come earlier.
2. **F6F (Visual Polish) is mispositioned.** Loading skeletons, error states, empty states, and animations should be added as part of each phase, not as a separate pass. A separate "Visual Polish" phase will lead to either (a) duplicate work or (b) neglect.
3. **F6G (Export) is low value.** CSV/PDF export of conversations is a nice-to-have that delays higher-impact features.
4. **No phase for cross-cutting concerns.** Token refresh, pagination, toast system, error boundaries, retry hooks—these are needed by multiple phases but owned by none.
5. **F6C (Profile & Settings) is mostly empty.** User profile (name, avatar) plus business settings. Can be done quickly and merged with F6A.

### Revised Ordering

| Phase | Name | Content | Dependencies | Est. PRs |
|---|---|---|---|---|
| **F6A** | **Foundation & Cross-Cutting** | Token refresh, pagination for conversations+contacts, toast system, retry hook pattern, error boundaries per page, DB indexes | None | 4 |
| **F6B** | **Contact Management** | Contact CRUD, tags (ARRAY), remove soft-delete, contact list/search in sidebar | F6A (pagination, toast) | 3 |
| **F6C** | **Profile & Settings** | Profile page, business hours config, canned responses (refactor created_by type), settings form | F6A (toast, error boundary) | 2 |
| **F6D** | **Inbox Search & Filter** | Search conversations, filter by status, sort options, infinite scroll in inbox | F6A (pagination), F6B (contact search) | 2 |
| **F6E** | **Chat Productivity** | Message search within conversation, text formatting toolbar, message timestamp grouping, scroll-to-bottom with unread marker | F6A (pagination, toast), F6D | 2 |
| **F6F** | **Dashboard & KPIs** | Summary stats (total convos, messages today, response rate), chart (messages over time), last conversations list | F6A (error boundary, skeletons) | 2 |
| **F6G** | **Final Polish** | Empty states audit, hover/active states audit, keyboard navigation audit, mobile responsiveness audit | All above | 1 |

**Removed:** F6G (Export) from original → moved to F7. Visual Polish merged into each phase as a deliverable criterion.

### PR Budget

Target: 300–500 lines per PR. **16 PRs total** across all F6 phases.

| Phase | PRs | Est. Lines |
|---|---|---|
| F6A | 4 | 1200–2000 |
| F6B | 3 | 900–1500 |
| F6C | 2 | 600–1000 |
| F6D | 2 | 600–1000 |
| F6E | 2 | 600–1000 |
| F6F | 2 | 600–1000 |
| F6G | 1 | 300–500 |
| **Total** | **16** | **4800–8000** |

---

## 6. Phase-by-Phase Detail

### F6A — Foundation & Cross-Cutting (4 PRs)

**Goal:** Fix the structural gaps that every subsequent phase depends on.

**PR 6A.1:** Token refresh
- Backend: `POST /api/v1/auth/refresh` endpoint that accepts a refresh token (or re-issues based on valid but expired access token)
- Backend: config for `REFRESH_TOKEN_EXPIRE_MINUTES` 
- Frontend: 401 interceptor in `lib/api.ts` that attempts refresh before failing
- Frontend: Update `AuthContext.tsx` to handle refresh flow
- Frontend: Store refresh token in httpOnly cookie or localStorage

**PR 6A.2:** Pagination infrastructure
- Backend: Add `limit`/`offset` query params to `GET /api/v1/conversations`
- Backend: Add `limit`/`offset` query params to `GET /api/v1/conversations/{id}/messages`
- Backend: Add `limit`/`offset` query params to `GET /api/v1/contacts` (new)
- Backend: Update response format to `{ data: [...], total: int, limit: int, offset: int }`
- Frontend: Create `usePaginatedQuery` hook with `{ data, total, loading, error, retry, loadMore }`
- Frontend: Add "Load more" / infinite scroll to conversations list

**PR 6A.3:** Toast system & retry hook pattern
- Frontend: Create lightweight toast component (auto-dismiss, stacked, 3 variants: success/error/info)
- Frontend: Create `ToastContext` with `{ showToast(msg, variant) }`
- Frontend: Create `useApi` hook: `{ data, loading, error, retry }` wrapper around fetch
- Frontend: Wire `ToastContext` into `_app.tsx`
- Frontend: Update `useConversations` to use `useApi` pattern
- Frontend: Update `useMessages` to use `useApi` pattern

**PR 6A.4:** Error boundaries per page + DB indexes
- Frontend: Create `PageErrorBoundary` component with "Try again" button and error message
- Frontend: Wrap each page in its own `PageErrorBoundary`
- Frontend: Keep the global `ErrorBoundary` as a last resort
- Backend: Add migration for indexes: `contacts.wa_id`, `messages.conversation_id`, `messages.timestamp`, `conversations.contact_id`
- Backend: Add DB migration for `contacts.tags` → `ARRAY(Text)` (prepares for F6B)

### F6B — Contact Management (3 PRs)

**Goal:** Full contact CRUD, search, and tags.

**PR 6B.1:** Contact list & search
- Backend: `GET /api/v1/contacts` with pagination, `?q=` search (name/wa_id), `?tag=` filter
- Backend: `POST /api/v1/contacts` to create new contact (name, wa_id required)
- Backend: `DELETE /api/v1/contacts/{wa_id}` soft-delete (or hard-delete if we removed soft-delete)
- Backend: Migration: remove `deleted_at`, change `tags` to `ARRAY(Text)`
- Backend: Service layer (`ContactService`) for new endpoints
- Frontend: `useContacts` hook
- Frontend: Contacts page at `/contacts` with list, search bar, tag filter chips
- Frontend: Add "Contactos" link to sidebar

**PR 6B.2:** Contact detail & edit
- Backend: `GET /api/v1/contacts/{wa_id}` expand response to include email, company, notes, tags, is_important
- Backend: `PATCH /api/v1/contacts/{wa_id}` update the new fields
- Backend: `ContactCreate` + `ContactUpdate` schemas with new fields
- Frontend: Contact detail page `/contacts/[wa_id]` with editable form
- Frontend: Save button with toast feedback
- Frontend: Loading skeleton for detail page

**PR 6B.3:** Contact sidebar integration
- Frontend: Show contact info panel in conversation view (right sidebar or drawer)
- Frontend: Quick-edit contact name/tags from conversation view
- Frontend: Link from conversation to contact detail
- Frontend: Empty state for contacts list ("No contacts yet")

### F6C — Profile & Settings (2 PRs)

**Goal:** User profile management and business configuration.

**PR 6C.1:** User profile
- Backend: `GET /api/v1/profile` — return user info
- Backend: `PATCH /api/v1/profile` — update name, avatar URL
- Backend: `POST /api/v1/profile/avatar` — upload avatar (store as file or URL)
- Frontend: Profile page at `/profile` with avatar upload, name edit
- Frontend: Loading skeleton + error state with retry + toast

**PR 6C.2:** Business settings & canned responses
- Backend: `GET /api/v1/settings` — return business hours, greeting message, etc.
- Backend: `PATCH /api/v1/settings` — update settings
- Backend: Migration: `CannedResponse.created_by` → UUID type fix
- Backend: `GET /api/v1/canned-responses`, `POST`, `PATCH`, `DELETE`
- Backend: `CannedResponseCreate`, `CannedResponseUpdate` schemas
- Frontend: Settings page at `/settings` with form fields
- Frontend: Canned responses manager (list, add, edit, delete)
- Frontend: Loading + error + empty states + toast for all operations

### F6D — Inbox Search & Filter (2 PRs)

**Goal:** Find conversations quickly.

**PR 6D.1:** Search conversations
- Backend: Add `?q=` param to `GET /api/v1/conversations` — search by contact name, wa_id, message content
- Backend: Use `ILIKE` with trigram index for performance
- Backend: `JSONB` or computed column for last message content to avoid N+1 on search
- Frontend: Search bar at top of conversation list (debounced, 300ms)
- Frontend: Search results sections with matching snippets
- Frontend: Empty search state ("No conversations match your search")

**PR 6D.2:** Filter & sort
- Backend: Add `?status=` filter (all/active/archived) to conversations list
- Backend: Add `?sort=` param (last_message_at/created_at/name) + `?order=` (asc/desc)
- Frontend: Filter tabs or dropdown above conversation list
- Frontend: Sort dropdown
- Frontend: Persist filter/sort preference in URL query params (shareable state)

### F6E — Chat Productivity (2 PRs)

**Goal:** Better messaging experience.

**PR 6E.1:** Message search & grouping
- Backend: `GET /api/v1/conversations/{id}/search?q=` — search within conversation messages
- Frontend: Message search bar inside conversation view
- Frontend: Date-based message grouping headers ("Today", "Yesterday", "Monday", etc.)
- Frontend: Jump-to-date picker
- Frontend: Loading + error states for search

**PR 6E.2:** Scroll & unread markers
- Frontend: Auto-scroll to bottom on conversation open (if viewing latest)
- Frontend: "Scroll to bottom" FAB when scrolled up
- Frontend: Unread message indicator (dot or count on conversation in list)
- Frontend: Keyboard shortcuts: Ctrl+F for search, Ctrl+Enter to send
- Frontend: Skeleton for message list loading

### F6F — Dashboard & KPIs (2 PRs)

**Goal:** Quick business intelligence.

**PR 6F.1:** Dashboard API
- Backend: `GET /api/v1/dashboard/stats` — total conversations, messages today/this week, response rate (percentage of conversations with at least one agent reply), average response time
- Backend: `GET /api/v1/dashboard/messages-over-time` — message count grouped by day for last 30 days
- Backend: Both endpoints should be cheap queries (no heavy aggregation)
- Backend: `DashboardStats`, `MessagesOverTime` response schemas

**PR 6F.2:** Dashboard UI
- Frontend: Dashboard page at `/dashboard` as new default landing page
- Frontend: Stat cards (4 cards in a grid: conversations, messages today, response rate, avg response time)
- Frontend: Simple line chart (messages over last 30 days) — use a minimal chart library or SVG-only
- Frontend: Recent conversations list (last 10)
- Frontend: Loading skeleton (card placeholders + chart shimmer)
- Frontend: Error state with retry per card (resilient — one failing stat doesn't break others)
- Frontend: Add "Dashboard" link to sidebar, make first/default nav item

### F6G — Final Polish (1 PR)

**Goal:** Audit and fix remaining UX gaps.

**PR 6G.1:** UX audit pass
- Every page: verify loading skeleton exists
- Every page: verify error state with retry exists
- Every page: verify empty state exists
- Every page: verify keyboard navigation (Tab order, Enter to activate)
- Every list: verify hover/active/focus states
- Mobile: verify sidebar works (already has toggle), verify conversation view is usable at 375px
- Dark mode: verify all new components respect dark mode (already well-implemented in existing code)
- Accessibility: verify all new interactive elements have `aria-label` or accessible text

---

## 7. Dependency Graph

```
F6A ──┬── F6B ──┬── F6D ──┬── F6E ──┐
      │         │         │          │
      │         └─────────┘          │
      │                              │
      ├── F6C ───────────────────────┤
      │                              │
      └──────────────────────────────┴── F6G
```

- F6A is the root dependency. Nothing starts without it.
- F6B and F6C can proceed in parallel after F6A.
- F6D depends on F6B (contacts search) + F6A (pagination).
- F6E depends on F6D (chat features) + F6A (toast, error boundaries).
- F6F depends on F6A (error boundaries, skeletons).
- F6G is last—audit pass over everything.

## 8. Backward Compatibility Risks

| Change | Risk | Mitigation |
|---|---|---|
| Adding pagination to conversations | Existing clients get `{ data, total, limit, offset }` instead of array | Deprecate old format: keep both for 1 release. Old clients get array with warning header. |
| Changing `tags` from CSV to ARRAY | Existing contacts with `"tag1,tag2"` stored as string | Migration: `UPDATE contact SET tags = string_to_array(tags, ',')` |
| Removing `deleted_at` | If any row has `deleted_at IS NOT NULL`, those contacts disappear | Migration: `DELETE FROM contact WHERE deleted_at IS NOT NULL` before removing column |
| Changing `CannedResponse.created_by` type | FK constraint may fail if values don't match | Migration: `ALTER TABLE canned_responses ALTER COLUMN created_by TYPE UUID USING created_by::uuid` |

## 9. Risk Analysis

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Token refresh introduces auth bugs | Medium | High (users locked out) | Test all 3 flows: valid token, expired token, invalid token. Rollback plan: revert to no-refresh. |
| Pagination breaks existing frontend | Medium | Medium | Dual-format response for 1 release. Frontend migrates to new format first. |
| Migration scripts fail on production DB | Low | High | Test migrations against a copy of production data. Have rollback scripts ready. |
| Dashboard aggregation queries are slow | Medium | Low | Keep date range small (30d). Add `messages.timestamp` index. If slow, cache for 5 min. |
| Scope creep in F6G (Polish) | High | Low | Strict checklist. Only pre-approved items. Everything else → F7. |

## 10. Summary of Recommendations

1. **Restructure phases:** Cross-cutting foundation first (F6A), then contacts + settings in parallel, then inbox + chat, then dashboard, then polish pass.
2. **Fix tags before building on them:** CSV→ARRAY migration in F6A, not F6B.
3. **Remove soft-delete:** No current use case. Adds complexity to every query.
4. **Add token refresh:** P1 security issue. Required before any new endpoint.
5. **Add pagination:** P1 scaling issue. Required before search/filter features.
6. **Add toast system:** Required for any user-facing action feedback.
7. **Add loading/error/empty states per phase:** Not as a separate polish pass.
8. **Fix CannedResponse.created_by type:** Before F6D.
9. **Use service layer for new endpoints:** Stop the pattern divergence from growing.
10. **16 PRs total, 300–500 lines each:** No mega-PRs.
