import {
  Contact,
  ContactCreatePayload,
  ContactListResponse,
  ContactUpdatePayload,
  Conversation,
  GetConversationsParams,
  Message,
  GetMessagesParams,
  Tag,
  TagCreatePayload,
  TokenResponse,
  User,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

interface QueuedRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  retry: () => Promise<unknown>;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private queue: QueuedRequest[] = [];
  private subscribers = new Set<(token: string | null) => void>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    try {
      this.channel = new BroadcastChannel("flowdesk-auth");
      this.channel.onmessage = (e) => {
        if (e.data?.type === "logout") this.handleRemoteLogout();
      };
    } catch {
      // BroadcastChannel not available
    }

    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === "auth_event") {
          try {
            const ev = JSON.parse(e.newValue || "{}");
            if (ev.type === "logout") this.handleRemoteLogout();
          } catch {
            // ignore
          }
        }
      });
    }
  }

  async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(options.headers);
    if (this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    const response = await fetch(url, { ...options, headers });

    if (response.ok) {
      return response.json();
    }

    if (response.status === 401) {
      const body = await response.json().catch(() => ({}));
      const errorCode = response.headers.get("X-Auth-Error") || body.code;

      if (errorCode === "token_expired") {
        return this.handleExpiredToken(() =>
          this.request<T>(url, options)
        );
      }

      throw new AuthError(body.detail || "Authentication failed");
    }

    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${response.status}`);
  }

  private handleExpiredToken<T>(
    retryFn: () => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        resolve: resolve as (v: unknown) => void,
        reject,
        retry: retryFn as () => Promise<unknown>,
      });

      if (!this.refreshPromise) {
        this.refreshPromise = this.executeRefresh().then((success) => {
          this.drainQueue(success);
          return success;
        });
      }
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

      const data: TokenResponse = await response.json();
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
        item
          .retry()
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

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    localStorage.setItem("refresh_token", refresh);
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

  async login(email: string, password: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail || "Error al iniciar sesión");
    }

    const data: TokenResponse = await response.json();
    this.setTokens(data.access_token, data.refresh_token);
    this.broadcastEvent({ type: "login" });
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      fetch(`${API_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    this.clearTokens();
    this.broadcastEvent({ type: "logout" });
  }

  async getMe(): Promise<User> {
    return this.request<User>(`${API_URL}/api/v1/auth/me`);
  }

  subscribe(callback: (token: string | null) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(token: string | null) {
    for (const cb of this.subscribers) {
      try {
        cb(token);
      } catch {
        // ignore subscriber error
      }
    }
  }

  private broadcastEvent(event: { type: string }) {
    try {
      localStorage.setItem("auth_event", JSON.stringify(event));
      this.channel?.postMessage(event);
    } catch {
      // localStorage might be full
    }
  }

  private handleRemoteLogout() {
    this.accessToken = null;
    localStorage.removeItem("refresh_token");
    this.notifySubscribers(null);
  }

  async refreshAuth(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    return this.executeRefresh();
  }
}

export const apiClient = new ApiClient();

export async function getConversations(
  params?: GetConversationsParams,
  signal?: AbortSignal
): Promise<Conversation[]> {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.set("status", params.status);
  }
  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }
  if (params?.offset) {
    searchParams.set("offset", String(params.offset));
  }

  const queryString = searchParams.toString();
  const url = `${API_URL}/api/v1/conversations${queryString ? `?${queryString}` : ""}`;

  return apiClient.request<Conversation[]>(url, { signal });
}

export async function getConversation(
  id: string,
  signal?: AbortSignal
): Promise<Conversation> {
  const url = `${API_URL}/api/v1/conversations/${id}`;
  return apiClient.request<Conversation>(url, { signal });
}

export async function getConversationMessages(
  conversationId: string,
  params?: GetMessagesParams,
  signal?: AbortSignal
): Promise<Message[]> {
  const searchParams = new URLSearchParams();

  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }
  if (params?.offset) {
    searchParams.set("offset", String(params.offset));
  }
  if (params?.after) {
    searchParams.set("after", params.after);
  }

  const queryString = searchParams.toString();
  const url = `${API_URL}/api/v1/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ""}`;

  return apiClient.request<Message[]>(url, { signal });
}

export async function sendMessage(
  conversationId: string,
  content: string,
  signal?: AbortSignal
): Promise<Message> {
  const url = `${API_URL}/api/v1/conversations/${conversationId}/messages`;

  return apiClient.request<Message>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
  });
}

export async function updateConversation(
  id: string,
  status: string
): Promise<Conversation> {
  const url = `${API_URL}/api/v1/conversations/${id}`;

  return apiClient.request<Conversation>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function getContacts(
  params?: { q?: string; limit?: number; offset?: number },
  signal?: AbortSignal
): Promise<ContactListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString();
  const url = `${API_URL}/api/v1/contacts${query ? `?${query}` : ""}`;
  return apiClient.request<ContactListResponse>(url, { signal });
}

export async function getContact(
  id: string,
  signal?: AbortSignal
): Promise<Contact> {
  return apiClient.request<Contact>(`${API_URL}/api/v1/contacts/${id}`, { signal });
}

export async function createContact(
  payload: ContactCreatePayload
): Promise<Contact> {
  return apiClient.request<Contact>(`${API_URL}/api/v1/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateContact(
  id: string,
  payload: ContactUpdatePayload
): Promise<Contact> {
  return apiClient.request<Contact>(`${API_URL}/api/v1/contacts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteContact(id: string): Promise<void> {
  await apiClient.request<void>(`${API_URL}/api/v1/contacts/${id}`, {
    method: "DELETE",
  });
}

export async function hardDeleteContact(id: string): Promise<void> {
  await apiClient.request<void>(`${API_URL}/api/v1/contacts/${id}/hard`, {
    method: "DELETE",
  });
}

export async function getTags(signal?: AbortSignal): Promise<Tag[]> {
  return apiClient.request<Tag[]>(`${API_URL}/api/v1/tags`, { signal });
}

export async function createTag(payload: TagCreatePayload): Promise<Tag> {
  return apiClient.request<Tag>(`${API_URL}/api/v1/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteTag(id: string): Promise<void> {
  await apiClient.request<void>(`${API_URL}/api/v1/tags/${id}`, {
    method: "DELETE",
  });
}

export async function assignTag(
  contactId: string,
  tagId: string
): Promise<void> {
  await apiClient.request<void>(
    `${API_URL}/api/v1/contacts/${contactId}/tags`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_id: tagId }),
    }
  );
}

export async function removeTag(
  contactId: string,
  tagId: string
): Promise<void> {
  await apiClient.request<void>(
    `${API_URL}/api/v1/contacts/${contactId}/tags/${tagId}`,
    { method: "DELETE" }
  );
}
