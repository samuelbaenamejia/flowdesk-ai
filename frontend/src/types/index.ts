export interface Conversation {
  id: string;
  contact_id: string;
  contact_name: string;
  status: "active" | "human_takeover" | "closed";
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetConversationsParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: "incoming" | "outgoing";
  content_type: string;
  content: string;
  wa_message_id: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  created_at: string;
}

export interface GetMessagesParams {
  limit?: number;
  offset?: number;
  after?: string;
}

export interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Contact {
  id: string;
  wa_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface ContactListResponse {
  items: Contact[];
  total: number;
  limit: number;
  offset: number;
}

export interface ContactCreatePayload {
  name: string;
  wa_id?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface ContactUpdatePayload {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface TagCreatePayload {
  name: string;
  color?: string;
}
