import {
  Conversation,
  GetConversationsParams,
  Message,
  GetMessagesParams,
  User,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(
  email: string,
  password: string
): Promise<{ access_token: string }> {
  const url = `${API_URL}/api/v1/auth/login`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail || "Error al iniciar sesión";
    throw new Error(detail);
  }

  return response.json();
}

export async function getMe(token: string): Promise<User> {
  const url = `${API_URL}/api/v1/auth/me`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Error al obtener usuario");
  }

  return response.json();
}

export async function getConversations(
  params?: GetConversationsParams
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

  const response = await fetch(url, { headers: authHeaders() });

  if (!response.ok) {
    throw new Error(`Error fetching conversations: ${response.status}`);
  }

  return response.json();
}

export async function getConversation(id: string): Promise<Conversation> {
  const url = `${API_URL}/api/v1/conversations/${id}`;

  const response = await fetch(url, { headers: authHeaders() });

  if (!response.ok) {
    throw new Error(`Error fetching conversation: ${response.status}`);
  }

  return response.json();
}

export async function getConversationMessages(
  conversationId: string,
  params?: GetMessagesParams
): Promise<Message[]> {
  const searchParams = new URLSearchParams();

  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }
  if (params?.offset) {
    searchParams.set("offset", String(params.offset));
  }

  const queryString = searchParams.toString();
  const url = `${API_URL}/api/v1/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { headers: authHeaders() });

  if (!response.ok) {
    throw new Error(`Error fetching messages: ${response.status}`);
  }

  return response.json();
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<Message> {
  const url = `${API_URL}/api/v1/conversations/${conversationId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail || `Error sending message: ${response.status}`;
    throw new Error(detail);
  }

  return response.json();
}

export async function updateConversation(
  id: string,
  status: string
): Promise<Conversation> {
  const url = `${API_URL}/api/v1/conversations/${id}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail || `Error updating conversation: ${response.status}`;
    throw new Error(detail);
  }

  return response.json();
}
