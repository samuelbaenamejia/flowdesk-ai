export interface Conversation {
  id: string;
  contact_id: string;
  contact_name: string;
  status: "active" | "human_takeover" | "closed";
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  unread_count?: number;
}

export interface ConversationFilters {
  q: string;
  status: string;
  date_from: string | null;
  date_to: string | null;
}

export interface GetConversationsParams {
  q?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface ConversationListResponse {
  items: Conversation[];
  total: number;
  limit: number;
  offset: number;
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

export interface MessageFilters {
  q: string;
  direction: string;
  status: string;
  date_from: string | null;
  date_to: string | null;
}

export interface GetMessagesParams {
  q?: string;
  direction?: "incoming" | "outgoing";
  status?: string;
  date_from?: string;
  date_to?: string;
  after?: string;
  limit?: number;
  offset?: number;
}

export interface MessageListResponse {
  items: Message[];
  total: number;
  limit: number;
  offset: number;
}

export interface SearchMessageResult {
  id: string;
  conversation_id: string;
  contact_name: string;
  content: string;
  direction: "incoming" | "outgoing";
  created_at: string;
  highlight: string;
}

export interface GlobalSearchParams {
  q: string;
  scope?: "all" | "conversations" | "messages";
  limit?: number;
  offset?: number;
}

export interface GlobalSearchResponse {
  conversations: {
    items: Conversation[];
    total: number;
  };
  messages: {
    items: SearchMessageResult[];
    total: number;
  };
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

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UpdateProfileRequest {
  name?: string | null;
  avatar_url?: string | null;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface TopContact {
  wa_id: string | null;
  name: string;
  message_count: number;
}

export interface DashboardStats {
  total_conversations: number;
  messages_today: number;
  messages_this_week: number;
  response_rate: number;
  avg_response_time_minutes: number;
  top_contacts: TopContact[];
}

export interface MessagesOverTimePoint {
  date: string;
  count: number;
}

export interface MessagesOverTimeResponse {
  data: MessagesOverTimePoint[];
}
