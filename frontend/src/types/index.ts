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
}

export interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}
