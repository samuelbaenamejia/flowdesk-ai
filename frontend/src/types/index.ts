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
