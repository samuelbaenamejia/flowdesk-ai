import {
  Conversation,
  GetConversationsParams,
  Message,
  GetMessagesParams,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error fetching conversations: ${response.status}`);
  }

  return response.json();
}

export async function getConversation(id: string): Promise<Conversation> {
  const url = `${API_URL}/api/v1/conversations/${id}`;

  const response = await fetch(url);

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

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error fetching messages: ${response.status}`);
  }

  return response.json();
}
