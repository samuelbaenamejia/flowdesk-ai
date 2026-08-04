# F6A PR1 — Token Refresh & HTTP Client Hardening

## 1. Objective

Build a robust authentication infrastructure that handles token expiration transparently, queues concurrent requests during refresh, and provides a solid foundation for all subsequent F6 phases.

**Scope is strictly limited to:**
- Backend: `POST /api/v1/auth/refresh` endpoint
- Backend: JWT token type differentiation (access vs refresh)
- Frontend: Rewritten HTTP client in `lib/api.ts`
- Frontend: Updated `AuthContext.tsx`
- Frontend: Cross-tab synchronization

**Out of scope (explicitly NOT included):**
- Contact management (F6B)
- Dashboard (F6E)
- Chat features (F6F)
- Any UI changes beyond auth behavior

---

## 2. Current State Audit

### Backend Findings

| # | Issue | Severity | Detail |
|---|---|---|---|
| B1 | **No refresh endpoint** | Critical | `POST /auth/login` returns only `access_token`. No way to get a new token without re-entering credentials. |
| B2 | **No token differentiation** | Critical | Backend issues the same token type for everything. No way to distinguish access vs refresh tokens. Can't revoke without changing `secret_key`. |
| B3 | **Silent JWT decode** | Medium | `decode_access_token()` returns `None` for ALL errors (expired, bad signature, malformed). Callers can't differentiate between "expired" and "tampered". |
| B4 | **24h token lifetime** | Low | Current `ACCESS_TOKEN_EXPIRE_MINUTES=1440` is reasonable for development but long for production. |
| B5 | **No token version/revocation** | Low | No `jti` (JWT ID) or token version in DB. Can't revoke individual tokens. |

### Frontend Findings

| # | Issue | Severity | Detail |
|---|---|---|---|
| F1 | **No 401 interceptor** | Critical | Every API function handles errors independently. No centralized "on 401, try refresh" logic. |
| F2 | **No refresh mechanism** | Critical | When token expires, all API calls fail with 401. User sees errors on every screen simultaneously. No silent recovery. |
| F3 | **No expiry pre-check** | Medium | Client never decodes the JWT to check `exp` before making requests. Wastes a round trip on every call when token is known-expired. |
| F4 | **No single-flight refresh** | High | 10 simultaneous requests with expired token = 10 failed requests, all independently trying to refresh. |
| F5 | **No cross-tab sync** | Medium | Login/logout in one tab does not affect other tabs. Token in localStorage is read independently by each tab. |
| F6 | **Polling ignores auth** | Medium | `useConversations` polls every 10s, `useMessages` polls every 5s. If token expires during polling, errors are silently swallowed and data stops updating. |
| F7 | **No retry logic** | Medium | No API call retries on transient failures. Only manual "retry" button in `useConversations`. |
| F8 | **authHeaders() is a function** | Low | Each call re-reads localStorage. Works but no caching. Fine for now. |

### Security Findings

| # | Issue | Severity | Detail |
|---|---|---|---|
| S1 | **Token in localStorage** | Medium | Accessible to any JS on the same origin. XSS = token theft. |
| S2 | **No httpOnly cookies** | Medium | No option for more secure cookie-based auth. |
| S3 | **No refresh token rotation** | Medium | Without rotation, a leaked refresh token is valid indefinitely. |

**Self-correction:** S1/S2/S3 are real but out of scope for F6A. Moving to cookie-based auth would require architectural changes (CSRF, CORS, API client redesign) that belong in a dedicated security phase (F7+). For F6A, we improve the token model within the current localStorage paradigm.

---

## 3. Architecture & Design

### 3.1 Token Model

Two distinct JWT types, differentiated by a `type` claim:

| Property | Access Token | Refresh Token |
|---|---|---|
| **Claim `type`** | `"access"` | `"refresh"` |
| **Lifetime** | 15 minutes | 7 days |
| **Storage (client)** | Memory (variable) | localStorage |
| **Sent on every API call** | Yes (`Authorization: Bearer`) | No |
| **Can be revoked** | No (short-lived) | Yes (via DB blacklist) |
| **Rotation** | N/A | Rotated on each use (old one invalidated) |

**Why short access token + long refresh token?**
- 15-minute access token limits the damage window if stolen (XSS)
- 7-day refresh token stored in localStorage, sent only to `/auth/refresh`
- Refresh token rotation: each refresh call returns a new refresh token, invalidating the previous one
- This limits the damage of a stolen refresh token to the window between rotation events

### 3.2 Token Payloads

**Access Token:**
```json
{
  "sub": "uuid-of-user",
  "type": "access",
  "exp": 1699000000,
  "iat": 1698999100
}
```

**Refresh Token:**
```json
{
  "sub": "uuid-of-user",
  "type": "refresh",
  "jti": "unique-token-id",
  "exp": 1699603900,
  "iat": 1698999100
}
```

- `jti` (JWT ID) is a UUID generated per refresh token. Stored in a `refresh_tokens` table. Used for revocation.

### 3.3 Database

New table for refresh token tracking:

```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_jti UUID NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_jti ON refresh_tokens(token_jti);
```

- `revoked_at IS NULL` = active token
- On rotation: old token's `revoked_at` is set, new token is inserted
- Cleanup: tokens with `expires_at < now()` AND `revoked_at IS NOT NULL` can be pruned

### 3.4 Backend Endpoints

#### `POST /api/v1/auth/login` (modified)

Returns both tokens:

```json
{
  "access_token": "<short-lived JWT>",
  "refresh_token": "<long-lived JWT>",
  "token_type": "bearer",
  "expires_in": 900
}
```

**Changes:**
- `create_access_token()` now receives `type="access"` claim and 15-minute expiry
- New `create_refresh_token()` creates token with `type="refresh"`, `jti`, and 7-day expiry
- Refresh token is stored in the `refresh_tokens` table with its `jti`

#### `POST /api/v1/auth/refresh` (new)

**Request:**
```json
{
  "refresh_token": "<long-lived JWT refresh token>"
}
```

**Flow:**
1. Decode refresh token. If invalid/expired → 401
2. Verify `payload.type === "refresh"`. If not → 401
3. Look up `token_jti` in `refresh_tokens` table. If not found or `revoked_at IS NOT NULL` → 401
4. Revoke old refresh token (set `revoked_at`)
5. Create new access token + new refresh token (rotation)
6. Return `{ access_token, refresh_token, token_type, expires_in }`

**Response:**
```json
{
  "access_token": "<new short-lived JWT>",
  "refresh_token": "<new long-lived JWT>",
  "token_type": "bearer",
  "expires_in": 900
}
```

**Why rotate refresh tokens?** If a refresh token is stolen (XSS), the attacker can use it once. After that, the legitimate user's next refresh will fail (old token revoked), alerting the system. Without rotation, a stolen refresh token is valid for 7 days.

#### `POST /api/v1/auth/logout` (new)

**Request:**
```json
{
  "refresh_token": "<current refresh token>"
}
```

**Flow:**
1. Decode refresh token
2. Revoke it in the `refresh_tokens` table (set `revoked_at`)
3. Return 200

This ensures that clicking "Logout" actually invalidates the refresh token server-side.

### 3.5 Backend Changes to `decode_access_token`

Current: `decode_access_token` returns `None` for ALL errors.

New: Differentiate error types:

```python
from enum import Enum

class TokenError(Enum):
    EXPIRED = "expired"
    INVALID_SIGNATURE = "invalid_signature"
    MALFORMED = "malformed"

def decode_access_token(token: str) -> tuple[dict | None, TokenError | None]:
    """Returns (payload, None) on success, (None, error) on failure."""
```

This allows the backend to return different HTTP status codes:
- EXPIRED → 401 with `detail="Token expirado"` and `code="token_expired"`
- INVALID_SIGNATURE → 401 with `detail="Token inválido"` and `code="token_invalid"`
- MALFORMED → 422 with `detail="Token malformado"`

The frontend 401 interceptor will check `code` to decide whether to attempt refresh (only on `token_expired`).

### 3.6 Frontend Architecture

#### 3.6.1 HTTP Client (`lib/api.ts`)

Rewritten from individual fetch functions to a class-based client:

```typescript
class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private queue: QueuedRequest[] = [];
  private subscribers: Set<(token: string | null) => void> = new Set();

  // Core request method
  async request<T>(config: RequestConfig): Promise<T>;

  // Auth methods
  async login(email: string, password: string): Promise<void>;
  async logout(): Promise<void>;
  async refreshAuth(): Promise<boolean>;

  // Token management
  setTokens(access: string, refresh: string): void;
  clearTokens(): void;
  getAccessToken(): string | null;
  subscribe(cb: (token: string | null) => void): () => void;
}
```

**Key behaviors:**

1. **Access token in memory only**: Not written to localStorage. Only refresh token is persisted.
2. **On 401 with `code=token_expired`**: Queue the request, trigger single-flight refresh, retry after refresh succeeds.
3. **On 401 with any other code**: Fail immediately. No retry.
4. **On 403/404/5xx**: Fail immediately. No retry.
5. **On network error**: Re-throw. Caller decides retry strategy.

#### 3.6.2 Single-Flight Refresh Mechanism

```
Request 1 ──→ 401 expired
                │
Request 2 ──→ 401 expired
                │
Request 3 ──→ 401 expired
                │
                ├── refreshPromise = refreshAuth()
                │        │
                │        ├── POST /auth/refresh
                │        │       │
                │        │       ├── Success → retry all queued requests
                │        │       └── Failure → reject all queued, clear tokens, notify subscribers
                │        │
                ├── await refreshPromise
                │       └── retry Request 1
                │
                ├── await refreshPromise
                │       └── retry Request 2
                │
                └── await refreshPromise
                        └── retry Request 3
```

**Implementation:**
```typescript
async refreshAuth(): Promise<boolean> {
  // If already refreshing, return existing promise (single-flight)
  if (this.refreshPromise) {
    return this.refreshPromise;
  }

  this.refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) return false;

      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      this.refreshPromise = null;
    }
  })();

  return this.refreshPromise;
}
```

#### 3.6.3 Request Queue

When a request gets a 401 with `code=token_expired`:

```typescript
// Instead of rejecting immediately, queue the request
private queue: Array<{
  resolve: (value: any) => void;
  reject: (err: Error) => void;
  retry: () => Promise<any>;
}> = [];

async enqueueRequest(retryFn: () => Promise<any>): Promise<any> {
  return new Promise((resolve, reject) => {
    this.queue.push({ resolve, reject, retry: retryFn });
  });
}

async drainQueue(success: boolean) {
  const q = [...this.queue];
  this.queue = [];
  
  for (const item of q) {
    if (success) {
      try {
        const result = await item.retry();
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
    } else {
      item.reject(new AuthError("Session expired"));
    }
  }
}
```

#### 3.6.4 Cross-Tab Synchronization

When a user logs out or logs in in one tab, other tabs need to know.

**Strategy: `storage` event + `BroadcastChannel` API**

```typescript
// On token change (login/logout/refresh):
localStorage.setItem("auth_event", JSON.stringify({
  type: "login" | "logout" | "refresh",
  timestamp: Date.now(),
}));

// Listen in other tabs:
window.addEventListener("storage", (e) => {
  if (e.key === "auth_event") {
    const event = JSON.parse(e.newValue);
    if (event.type === "logout") {
      this.clearTokens();
      notifySubscribers(null);
    }
  }
});
```

`BroadcastChannel` as fallback for same-origin cross-tab communication (more reliable than `storage` event):

```typescript
const channel = new BroadcastChannel("flowdesk-auth");
channel.postMessage({ type: "logout" });
channel.onmessage = (e) => {
  if (e.data.type === "logout") this.clearTokens();
};
```

This ensures:
- Logging out in tab A → tab B immediately knows
- Logging in in tab A → tab B knows (but doesn't automatically use the session — user must refresh)
- Refresh in tab A → tab B's next 401 will attempt its own refresh

#### 3.6.5 AuthContext Changes

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isRefreshing: boolean;
}
```

- `token` removed from context (managed internally by ApiClient)
- `loading` stays true until initial token validation completes
- `login()` calls ApiClient.login(), which stores refresh_token in localStorage and access_token in memory
- `logout()` calls ApiClient.logout(), which POSTs to `/auth/logout` and clears tokens
- `isRefreshing` exposed for UI to show a subtle indicator during refresh

### 3.7 Polling Compatibility

Hooks that poll (`useConversations`, `useMessages`, `useConversation`) will go through `ApiClient.request()`. If the access token expires between polls:

1. Poll request gets 401 with `code=token_expired`
2. ApiClient queues the request and triggers refresh
3. Refresh succeeds → poll request retries → data updates normally
4. No visible interruption to the user

If refresh fails:
1. Queue is rejected
2. Polling silently stops (`.catch(() => {})` in existing hooks)
3. User sees stale data but no error flash
4. On next user interaction (e.g., clicking a conversation), the failed request triggers logout redirect

---

## 4. Sequence Diagrams

### 4.1 Login Flow

```
User          LoginPage        AuthContext      ApiClient        Backend
 │                │                │               │               │
 │  submit form   │                │               │               │
 │───────────────>│                │               │               │
 │                │  login(em,pw)  │               │               │
 │                │──────────────>│               │               │
 │                │                │  POST /login  │               │
 │                │                │──────────────>│──────────────>│
 │                │                │               │               │
 │                │                │               │  {access,     │
 │                │                │               │   refresh,    │
 │                │                │               │   expires_in} │
 │                │                │               │<──────────────│
 │                │                │               │               │
 │                │                │  setTokens()  │               │
 │                │                │<──────────────│               │
 │                │                │               │               │
 │                │  { user }      │               │               │
 │                │<──────────────│               │               │
 │                │               │               │               │
 │  redirect to   │               │               │               │
 │  dashboard     │               │               │               │
 │<───────────────│               │               │               │
```

### 4.2 Normal Request Flow

```
Component         ApiClient          Backend
    │                 │                │
    │  request()      │                │
    │────────────────>│                │
    │                 │  GET /resource │
    │                 │  Authorization:│
    │                 │  Bearer <access│
    │                 │  token>        │
    │                 │───────────────>│
    │                 │                │
    │                 │  200 + data    │
    │                 │<───────────────│
    │                 │                │
    │  return data    │                │
    │<────────────────│                │
```

### 4.3 Expired Token → Refresh → Retry Flow

```
Component         ApiClient          Backend
    │                 │                │
    │  request()      │                │
    │────────────────>│                │
    │                 │  GET /resource │
    │                 │───────────────>│
    │                 │                │
    │                 │  401 +         │
    │                 │  code=token_   │
    │                 │  expired       │
    │                 │<───────────────│
    │                 │                │
    │                 │  ┌─ queue req  │
    │                 │  ├─ refresh    │
    │                 │  │  promise=   │
    │                 │  │  null?      │
    │                 │  │             │
    │                 │  │  POST       │
    │                 │  │  /auth/     │
    │                 │  │  refresh    │
    │                 │  │────────────>│
    │                 │  │             │
    │                 │  │  { new      │
    │                 │  │  access,    │
    │                 │  │  new refresh}│
    │                 │  │<────────────│
    │                 │  │             │
    │                 │  ├─ retry all  │
    │                 │  │  queued     │
    │                 │  │             │
    │                 │  │  GET /res   │
    │                 │  │  Bearer new │
    │                 │  │────────────>│
    │                 │  │  200 + data │
    │                 │  │<────────────│
    │                 │                │
    │  return data    │                │
    │<────────────────│                │
```

### 4.4 Refresh Failure Flow

```
Component         ApiClient          Backend
    │                 │                │
    │  request()      │                │
    │────────────────>│                │
    │                 │  401 expired   │
    │                 │<───────────────│
    │                 │                │
    │                 │  refresh()     │
    │                 │  POST /refresh │
    │                 │───────────────>│
    │                 │                │
    │                 │  401 (refresh  │
    │                 │  also expired  │
    │                 │  or revoked)   │
    │                 │<───────────────│
    │                 │                │
    │                 │  ┌─ drain queue│
    │                 │  │  (reject)   │
    │                 │  ├─ clear      │
    │                 │  │  tokens     │
    │                 │  ├─ notify     │
    │                 │  │  subscribers│
    │                 │  │  (null)     │
    │                 │                │
    │  AuthError      │                │
    │<────────────────│                │
    │                 │                │
    │  ┌─ AuthGuard   │                │
    │  │  sees user=  │                │
    │  │  null        │                │
    │  ├─ redirect    │                │
    │  │  to /login   │                │
```

### 4.5 Concurrent Requests Flow

```
Component1     Component2     Component3      ApiClient          Backend
    │              │              │               │                │
    │  request()   │              │               │                │
    │─────────────>│              │               │                │
    │              │  request()   │               │                │
    │              │─────────────>│               │                │
    │              │              │  request()    │                │
    │              │              │──────────────>│                │
    │              │              │               │                │
    │              │              │     ALL GET 401 expired         │
    │              │              │               │<───────────────│
    │              │              │               │<───────────────│
    │              │              │               │<───────────────│
    │              │              │               │                │
    │              │              │    ┌── queue all 3              │
    │              │              │    ├── refreshPromise === null  │
    │              │              │    ├── refreshPromise = POST    │
    │              │              │    │                │           │
    │              │         ─── ALL await same ───    │           │
    │              │              │    │   promise     │           │
    │              │              │    │                │           │
    │              │              │    │  200 OK        │           │
    │              │              │    │<───────────────│           │
    │              │              │    │                │           │
    │              │              │    ├── refreshPromise = null    │
    │              │              │    ├── retry all 3              │
    │              │              │    │                │           │
    │              │              │    │  ALL GET 200   │           │
    │              │              │    │<───────────────│           │
    │              │              │    │<───────────────│           │
    │              │              │    │<───────────────│           │
    │              │              │    │                │           │
    │  return      │  return      │  return            │           │
    │<─────────────│<─────────────│<───────────────────│           │
```

---

## 5. Detailed Request Queue Implementation

```typescript
interface QueuedRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  retry: () => Promise<any>;
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private queue: QueuedRequest[] = [];
  private subscribers = new Set<(token: string | null) => void>();
  private channel: BroadcastChannel;

  constructor() {
    // Restore refresh token from localStorage on initialization
    const storedRefresh = localStorage.getItem("refresh_token");
    if (storedRefresh) {
      this.refreshToken = storedRefresh;
    }
    this.channel = new BroadcastChannel("flowdesk-auth");
    this.channel.onmessage = (e) => {
      if (e.data.type === "logout") this.handleRemoteLogout();
      if (e.data.type === "login") this.handleRemoteLogin();
    };
    window.addEventListener("storage", (e) => {
      if (e.key === "auth_event") {
        const ev = JSON.parse(e.newValue || "{}");
        if (ev.type === "logout") this.handleRemoteLogout();
      }
    });
  }

  // ── Core request method ──

  async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    const response = await fetch(url, { ...options, headers });

    if (response.ok) {
      return response.json();
    }

    // Handle 401 specifically
    if (response.status === 401) {
      const body = await response.json().catch(() => ({}));
      
      // Only attempt refresh for token_expired, not for other 401s
      if (body.code === "token_expired") {
        return this.handleExpiredToken(() => this.request<T>(url, options));
      }
      
      // Invalid token, inactive user, etc. — fail immediately
      throw new AuthError(body.detail || "Authentication failed");
    }

    // Non-401 errors
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${response.status}`);
  }

  // ── Token expiration handling ──

  private async handleExpiredToken<T>(retryFn: () => Promise<T>): Promise<T> {
    // Queue this request
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ resolve, reject, retry: retryFn });
      
      // Trigger refresh if not already in progress
      if (!this.refreshPromise) {
        this.refreshPromise = this.executeRefresh();
      }
      
      // Wait for the refresh to complete, then retry or reject
      this.refreshPromise.then((success) => {
        this.drainQueue(success);
      });
    });
  }

  private async executeRefresh(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) return false;

      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      this.refreshPromise = null;
    }
  }

  private drainQueue(success: boolean) {
    const q = [...this.queue];
    this.queue = [];
    
    for (const item of q) {
      if (success) {
        item.retry()
          .then(item.resolve)
          .catch(item.reject);
      } else {
        item.reject(new AuthError("Session expired"));
      }
    }

    if (!success) {
      this.clearTokens();
      this.notifySubscribers(null);
    }
  }

  // ── Token management ──

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    localStorage.setItem("refresh_token", refresh);
    this.broadcastEvent({ type: "refresh" });
    this.notifySubscribers(access);
  }

  clearTokens() {
    this.accessToken = null;
    localStorage.removeItem("refresh_token");
    this.notifySubscribers(null);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  // ── Auth actions ──

  async login(email: string, password: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || "Error al iniciar sesión");
    }

    const data = await response.json();
    this.setTokens(data.access_token, data.refresh_token);
    this.broadcastEvent({ type: "login" });
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      // Attempt server-side invalidation (fire-and-forget)
      fetch(`${API_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    this.clearTokens();
    this.broadcastEvent({ type: "logout" });
  }

  // ── Cross-tab communication ──

  private broadcastEvent(event: { type: string }) {
    try {
      localStorage.setItem("auth_event", JSON.stringify(event));
      this.channel.postMessage(event);
    } catch { /* localStorage might be full */ }
  }

  private handleRemoteLogout() {
    this.accessToken = null;
    localStorage.removeItem("refresh_token");
    this.notifySubscribers(null);
  }

  private handleRemoteLogin() {
    // Don't auto-login other tabs — the new tab's AuthContext
    // will read from localStorage on mount
  }

  // ── Subscription (for AuthContext) ──

  subscribe(callback: (token: string | null) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(token: string | null) {
    for (const cb of this.subscribers) {
      try { cb(token); } catch { /* ignore */ }
    }
  }
}

// Singleton
export const apiClient = new ApiClient();
```

---

## 6. Backend Changes

### 6.1 Config Changes (`core/config.py`)

Add:
```python
refresh_token_expire_minutes: int = 10080  # 7 days
access_token_expire_minutes: int = 15      # was 1440, now 15
```

### 6.2 Token Creation (`services/auth_service.py`)

```python
import uuid

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode.update({
        "type": "access",
        "exp": datetime.now(UTC) + timedelta(
            minutes=settings.access_token_expire_minutes
        ),
        "iat": datetime.now(UTC),
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode.update({
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "exp": datetime.now(UTC) + timedelta(
            minutes=settings.refresh_token_expire_minutes
        ),
        "iat": datetime.now(UTC),
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
```

### 6.3 Token Decode (differentiated errors)

```python
from enum import Enum
from jose import JWTError, ExpiredSignatureError

class TokenErrorCode(str, Enum):
    EXPIRED = "token_expired"
    INVALID = "token_invalid"
    MALFORMED = "token_malformed"

def decode_access_token(token: str) -> tuple[dict | None, TokenErrorCode | None]:
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[ALGORITHM]
        )
        return payload, None
    except ExpiredSignatureError:
        return None, TokenErrorCode.EXPIRED
    except JWTError:
        return None, TokenErrorCode.INVALID
```

### 6.4 Refresh Endpoint

```python
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    token_data, error = decode_access_token(payload.refresh_token)
    
    if error or token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
            headers={"X-Auth-Error": "token_invalid"},
        )
    
    jti = token_data.get("jti")
    user_id_raw = token_data.get("sub")
    
    # Verify token exists in DB and is not revoked
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_jti == uuid.UUID(jti),
            RefreshToken.revoked_at.is_(None),
        )
    )
    stored_token = result.scalar_one_or_none()
    
    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revocado o inexistente",
            headers={"X-Auth-Error": "token_revoked"},
        )
    
    # Verify user still exists and is active
    user_result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id_raw))
    )
    user = user_result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
        )
    
    # Revoke old refresh token
    stored_token.revoked_at = datetime.now(UTC)
    
    # Create new tokens
    new_access = create_access_token({"sub": user_id_raw})
    new_refresh = create_refresh_token({"sub": user_id_raw})
    
    # Store new refresh token
    db.add(RefreshToken(
        user_id=user.id,
        token_jti=uuid.UUID(jwt.decode(new_refresh, settings.secret_key, algorithms=[ALGORITHM])["jti"]),
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.refresh_token_expire_minutes),
    ))
    
    await db.commit()
    
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )
```

### 6.5 Modified Login Endpoint

```python
@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_login),
) -> TokenResponse:
    user = await get_user_by_email(payload.email, db)
    
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo",
        )
    
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    # Store refresh token in DB
    db.add(RefreshToken(
        user_id=user.id,
        token_jti=uuid.UUID(jwt.decode(refresh_token, settings.secret_key, algorithms=[ALGORITHM])["jti"]),
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.refresh_token_expire_minutes),
    ))
    await db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )
```

### 6.6 Updated `get_current_user` (`api/deps.py`)

```python
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload, error = decode_access_token(credentials.credentials)
    
    if error == TokenErrorCode.EXPIRED:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"X-Auth-Error": "token_expired"},
        )
    
    if error or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )
    
    # ... rest of user lookup unchanged
```

---

## 7. Frontend Changes: AuthContext

```typescript
// AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { User } from "@/types";
import { apiClient } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isRefreshing: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  isRefreshing: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Subscribe to token changes from ApiClient
  useEffect(() => {
    const unsub = apiClient.subscribe((token) => {
      if (!token) {
        setUser(null);
      }
    });
    return unsub;
  }, []);

  // Validate existing session on mount
  useEffect(() => {
    const storedRefresh = localStorage.getItem("refresh_token");
    if (!storedRefresh) {
      setLoading(false);
      return;
    }

    // Try to get user with current access token (if any)
    // If no access token in memory, trigger refresh
    const init = async () => {
      const token = apiClient.getAccessToken();
      if (token) {
        try {
          const userData = await getMe(token);
          setUser(userData);
        } catch {
          // Token in memory expired, try refresh
          await attemptSessionRestore();
        }
      } else {
        await attemptSessionRestore();
      }
      setLoading(false);
    };

    init();
  }, []);

  async function attemptSessionRestore() {
    const success = await apiClient.refreshAuth();
    if (success) {
      const userData = await getMe(apiClient.getAccessToken()!);
      setUser(userData);
    } else {
      localStorage.removeItem("refresh_token");
    }
  }

  const login = async (email: string, password: string) => {
    await apiClient.login(email, password);
    const userData = await getMe(apiClient.getAccessToken()!);
    setUser(userData);
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isRefreshing }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 8. Edge Case Analysis

### 8.1 Two Tabs Open

| Scenario | Behavior |
|---|---|
| Tab A logs out | `apiClient.logout()` → clears tokens, broadcasts `auth_event`. Tab B receives `storage` event, calls `apiClient.handleRemoteLogout()` → clears tokens → `AuthGuard` redirects to `/login`. |
| Tab A logs in | Tokens stored. Tab B receives `login` event but does NOT auto-login Tab B (user would need to refresh). This prevents confusion. |
| Tab A refreshes token | Refresh token in localStorage is updated. Tab B's next 401 will use the new refresh token from localStorage. |
| Tab A has expired token, Tab B has fresh token | Each tab manages its own access token in memory. No conflict. |

### 8.2 Polling Active

| Scenario | Behavior |
|---|---|
| Token expires during polling | Poll request gets 401 `token_expired` → queued → single-flight refresh → retry → polls continue normally. |
| Refresh also fails during polling | Queue rejected. Polling `.catch(() => {})` swallows the error silently. Polling stops. Next user interaction triggers redirect. |
| Polling continues after refresh | New access token is attached to subsequent poll requests. No interruption. |

### 8.3 Refresh Token Expired

| Scenario | Behavior |
|---|---|
| 7 days passed since last login | `executeRefresh()` → `POST /refresh` → backend checks `exp` → returns 401. `executeRefresh()` returns `false`. Queue drained with reject. `clearTokens()`. `AuthGuard` → redirect to `/login`. |
| User never logged out | After 7 days of inactivity, user is logged out on next interaction. Same as above. |

### 8.4 Refresh Token Revoked

| Scenario | Behavior |
|---|---|
| User logged out in another device | Old refresh token has `revoked_at` set. Next refresh attempt → 401. Same flow as expired. |
| Attacker used stolen refresh token | If attacker refreshes before legitimate user, the legitimate user's next refresh fails (old token revoked). User is logged out. Alerting mechanism (log `refresh_token_revoked`) can be added in F7. |

### 8.5 Backend Down

| Scenario | Behavior |
|---|---|
| Backend returns 502 during refresh | `executeRefresh()` catches the error, returns `false`. Queue rejected. User sees "Session expired" error. |
| Backend returns 502 on normal request | `request()` throws the error. Caller handles it (error state + retry button). No auth flow involved. |

### 8.6 Internet Intermittent

| Scenario | Behavior |
|---|---|
| Request fails with `TypeError: Failed to fetch` | Caught by `executeRefresh()` → returns `false`. Also caught by `request()` → throws `Error`. No infinite retry loop. |
| Request succeeds but response is incomplete | JSON parse fails in `response.json()` → throws. Caller handles. |

### 8.7 User Logs Out During Refresh

| Scenario | Behavior |
|---|---|
| User clicks Logout while refresh is in-flight | `logout()` calls `clearTokens()` setting `accessToken = null`. `refreshPromise` resolves with `success=true` (refresh already completed). `drainQueue(true)` retries requests but with `accessToken = null`. Those requests get 401 again (no auth header) → fail. AuthGuard detects `user=null` → redirect. |
| Race condition prevented | `clearTokens()` sets `accessToken = null` before `drainQueue`. Retried requests have no Bearer header. |

### 8.8 Multiple Simultaneous 401s

Covered in Sequence Diagram 4.5. All requests get queued behind a single refresh.

### 8.9 Refresh Endpoint Returns 500

| Scenario | Behavior |
|---|---|
| Server error on refresh | `executeRefresh()` → `response.ok` is false → returns `false`. Queue drained with reject. User is logged out. No infinite retry. |

### 8.10 Client Clock Desynchronized

| Scenario | Behavior |
|---|---|
| Client clock is 5 minutes behind | `iat` and `exp` are server-generated timestamps. Clock skew is handled by `jose` library (default leeway is 0, configurable via `options={"leeway": 30}`) |
| Client clock is 5 minutes ahead | Tokens appear to have been issued in the future. `jose` rejects them as not-yet-valid. Adding 30s leeway in `jwt.decode(options={"leeway": 30})` mitigates this. |

---

## 9. Security Analysis

| Concern | Assessment | Mitigation |
|---|---|---|
| **XSS** | Access token is in memory only (not localStorage). Refresh token is in localStorage. | If XSS attacker has access to localStorage, they get the refresh token. But rotation limits the damage window. |
| **CSRF** | Bearer token auth is immune to CSRF (token is in header, not cookie). | No action needed. |
| **Refresh token theft** | If refresh token is stolen, attacker can get new access tokens until rotation. | Rotation limits to a single use. Alerting (F7) can detect concurrent refreshes. |
| **Replay attacks** | Access token is valid for 15 min. Refresh token is rotated. | Acceptable risk. For production, add `jti` blacklist for access tokens. |
| **Logout** | Server-side logout revokes the refresh token. | Stolen refresh token is immediately invalid. |
| **Storage** | localStorage is synchronous, accessible to any JS on the origin. | Acceptable for F6 scope. Cookie-based auth (httpOnly) is a future improvement. |

---

## 10. Compatibility with F5

### F5A (Webhooks + AI)
- No changes. Webhooks do not use JWT auth.
- Internal endpoints use `X-Internal-Key` header, unaffected.

### F5B (Inbox + Messages)
- `useConversations`, `useMessages`, `useConversation` will be updated to use `apiClient.request()`.
- The return types and shapes are unchanged.
- Polling continues to work — refresh happens transparently.

### F5C (Conversation Status)
- `updateConversation()` uses `apiClient.request()`. No functional change.

### F5D (N8N Integration)
- Internal endpoints use `X-Internal-Key`. No change.

### No regressions if:
1. Existing `login()` flow still returns a token on success → user is redirected to `/conversations`.
2. Existing `getMe()` still returns user data.
3. Existing API functions (`getConversations`, `getMessages`, `sendMessage`, etc.) return the same data shapes.
4. The `authHeaders()` function is no longer used — replaced by `apiClient.request()` which injects the Bearer token automatically.
5. `ErrorBoundary` and `AuthGuard` continue to work unchanged.

---

## 11. Testing Strategy

### 11.1 Backend Unit Tests

| Test | Description |
|---|---|
| `POST /auth/login` returns both tokens | Verify `access_token` and `refresh_token` in response |
| `POST /auth/login` stores refresh token in DB | Query `refresh_tokens` table |
| `POST /auth/refresh` with valid token | Returns new tokens, old token is revoked |
| `POST /auth/refresh` with expired token | Returns 401 |
| `POST /auth/refresh` with revoked token | Returns 401 |
| `POST /auth/refresh` with access token (not refresh) | Returns 401 |
| `POST /auth/refresh` with tampered token | Returns 401 |
| `POST /auth/logout` revokes token | Subsequent refresh with same token returns 401 |
| `GET /me` with expired access token | Returns 401 with `X-Auth-Error: token_expired` |
| `GET /me` with valid token | Returns user data (unchanged) |
| `GET /me` with no token | Returns 401 (unchanged) |

### 11.2 Frontend Unit Tests

| Test | Description |
|---|---|
| `apiClient.request()` with valid token | Returns data |
| `apiClient.request()` with expired token | Triggers refresh, retries, returns data |
| `apiClient.request()` with refresh token expired | Returns `AuthError`, clears tokens |
| Single-flight: 3 concurrent expired requests | Only 1 refresh call, all 3 retry successfully |
| `apiClient.refreshAuth()` called simultaneously | Returns same promise, only 1 network request |
| `apiClient.logout()` clears tokens and broadcasts | localStorage item removed, `auth_event` set |
| Cross-tab: `storage` event received | Clears tokens, triggers AuthGuard redirect |
| `apiClient.login()` stores tokens and notifies | Access in memory, refresh in localStorage |
| Queue drain: refresh fails | All queued requests rejected with `AuthError` |

### 11.3 Manual Test Scenarios

1. **Login → use app → wait 15 min → app still works** (automatic refresh)
2. **Login → close tab → reopen → session restored** (refresh token in localStorage)
3. **Login → clear localStorage → next interaction → redirect to login**
4. **Login → modify token in DevTools → next request → 401 → redirect**
5. **Open 2 tabs → login in A → logout in A → B redirects to login**
6. **Open tab → wait for polling → kill backend → polling fails silently → restore backend → next interaction works** (refresh on next request)

---

## 12. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Token refresh causes infinite loop | Low | High | Only retry once per request. If retry also gets 401, fail permanently. |
| Race condition on logout during refresh | Low | Medium | `clearTokens()` sets `accessToken = null`. Retried requests with null token get 401 → fail → safe. |
| Cross-tab broadcast fails in Safari | Medium | Low | Fallback to `storage` event listener which works in all browsers. |
| Refresh token stored in localStorage is stolen via XSS | Medium | Medium | Rotation limits window to single use. F7 adds httpOnly cookies. |
| Backward compat: existing tokens still work? | Low | High | Old tokens have no `type` claim. `get_current_user` must accept tokens without type claim (for transition). |

### Backward Compatibility for Existing Tokens

For a smooth transition, the new `get_current_user` should accept both old-style (no `type` claim) and new-style (`type: "access"`) tokens during a transition period:

```python
if payload.get("type") not in (None, "access"):
    raise HTTPException(...)
```

This allows users with existing 24h tokens to continue working. After the transition period (one `access_token_expire_minutes` cycle), all tokens will have the `type` claim.

---

## 13. Implementation Plan

### Step 1: Backend Models & Migration
- Create `RefreshToken` model
- Create migration for `refresh_tokens` table
- Update `Settings` with new config values

### Step 2: Backend Auth Changes
- Update `create_access_token` with `type`, `iat` claims
- Add `create_refresh_token` with `type`, `jti`, `iat`, long expiry
- Update `decode_access_token` to return differentiated errors
- Update `get_current_user` to check `type` claim and return `X-Auth-Error` header
- Add `POST /auth/refresh` endpoint
- Add `POST /auth/logout` endpoint
- Update `POST /auth/login` to return both tokens

### Step 3: Frontend API Client
- Rewrite `lib/api.ts` with `ApiClient` class
- Implement single-flight refresh
- Implement request queue
- Implement cross-tab sync
- Add `AuthError` class

### Step 4: Frontend AuthContext
- Update `AuthContext.tsx` to use `ApiClient`
- Remove `token` from context (managed internally)
- Add session restore on mount
- Wire up cross-tab logout handling

### Step 5: Update Existing API Functions
- Refactor `getConversations`, `getMessages`, `sendMessage`, `updateConversation`, `getMe` to use `apiClient.request()`
- Keep all return types identical

### Step 6: Tests
- Backend: refresh, logout, updated login
- Frontend: single-flight, queue, cross-tab

### Step 7: Manual Verification
- Full login/refresh/logout cycle
- 2-tab logout sync
- Polling continuity after token expiry

---

## 14. Files Changed

| File | Change Type | Est. Lines |
|---|---|---|
| `backend/app/models/refresh_token.py` | New | 25 |
| `backend/app/models/__init__.py` | Modified | +1 |
| `backend/app/core/config.py` | Modified | +2 |
| `backend/app/services/auth_service.py` | Modified | ~+40 |
| `backend/app/api/deps.py` | Modified | ~+20 |
| `backend/app/api/v1/auth.py` | Modified | ~+60 |
| `backend/app/schemas/auth.py` | Modified | ~+10 |
| `frontend/src/lib/api.ts` | Rewritten | ~200 |
| `frontend/src/contexts/AuthContext.tsx` | Modified | ~+30 |
| `frontend/src/types/index.ts` | Modified | ~+5 |
| `backend/tests/test_auth.py` | Modified | ~+80 |
| Migration | New | ~30 |
| **Total** | | **~503** |

---

## 15. Acceptance Criteria Checklist

- [ ] Login returns both access and refresh tokens
- [ ] `/auth/refresh` returns new tokens and revokes old ones
- [ ] `/auth/logout` revokes the refresh token server-side
- [ ] Expired access token returns 401 with `X-Auth-Error: token_expired`
- [ ] `ApiClient` intercepts 401 `token_expired` and auto-refreshes
- [ ] `ApiClient` does NOT intercept other 401s (invalid token, inactive user)
- [ ] Single-flight: 10 concurrent requests → 1 refresh call
- [ ] Failed refresh → queue rejected → tokens cleared → redirect to login
- [ ] Logout in one tab → other tab redirects to login
- [ ] Polling continues through token expiry without visible interruption
- [ ] Existing token format (no `type` claim) still works (transition period)
- [ ] All existing API functions return same data shapes
- [ ] All existing tests pass
- [ ] No regressions in F5A, F5B, F5C, F5D

---

## 16. Veredict

**READY FOR IMPLEMENTATION**

The design addresses all identified issues:

| Issue | Before | After |
|---|---|---|
| Token expiry | 24h static token | 15min access + 7d refresh |
| Refresh mechanism | None | `POST /auth/refresh` with rotation |
| 401 handling | Per-function, no retry | Centralized interceptor with auto-refresh |
| Single-flight | N/A | Shared promise, one refresh at a time |
| Cross-tab sync | None | `BroadcastChannel` + `storage` event |
| Request queue | N/A | Queue + drain on refresh resolve |
| Error differentiation | `None` for all errors | `token_expired`, `token_invalid`, `token_malformed` |
| Logout (server-side) | None | `POST /auth/logout` revokes refresh token |
| Backward compat | N/A | Transition period for old tokens |

**Total estimated lines: ~503** (within the 500-line target, with marginal overflow in tests)
