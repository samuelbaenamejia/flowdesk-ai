import { useEffect, useState, useCallback, useRef } from "react";
import { getConversationMessages, sendMessage as apiSendMessage } from "@/lib/api";
import { Message } from "@/types";

const LIMIT = 50;
const POLL_INTERVAL = 5000;

interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  sendMessage: (content: string) => Promise<void>;
  sending: boolean;
  sendError: string | null;
}

export function useMessages(conversationId: string | undefined): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const lastFetchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    const cid = conversationId;

    const controller = new AbortController();

    async function fetchMessages() {
      setLoading(true);
      setError(null);
      try {
        const data = await getConversationMessages(
          cid,
          { limit: LIMIT, offset },
          controller.signal
        );
        if (!controller.signal.aborted) {
          if (offset === 0) {
            setMessages(data);
          } else {
            setMessages((prev) => [...data, ...prev]);
          }
          setHasMore(data.length >= LIMIT);
          if (data.length > 0) {
            lastFetchRef.current = new Date().toISOString();
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Error al cargar mensajes");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchMessages();
    return () => controller.abort();
  }, [conversationId, offset]);

  useEffect(() => {
    if (!conversationId) return;

    function poll() {
      if (document.visibilityState !== "visible") return;
      const after = lastFetchRef.current;
      if (!after) return;
      getConversationMessages(conversationId!, { after, limit: LIMIT })
        .then((newMessages) => {
          if (newMessages.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const unique = newMessages.filter((m) => !existingIds.has(m.id));
              return unique.length > 0 ? [...prev, ...unique] : prev;
            });
          }
          lastFetchRef.current = new Date().toISOString();
        })
        .catch(() => {});
    }

    const intervalId = setInterval(poll, POLL_INTERVAL);

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        poll();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [conversationId]);

  const loadMore = useCallback(() => {
    setOffset((prev) => prev + LIMIT);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !content.trim()) return;

    setSending(true);
    setSendError(null);

    try {
      const newMessage = await apiSendMessage(conversationId, content.trim());
      setMessages((prev) => [...prev, newMessage]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al enviar mensaje";
      setSendError(msg);
      throw err;
    } finally {
      setSending(false);
    }
  }, [conversationId]);

  return { messages, loading, error, hasMore, loadMore, sendMessage, sending, sendError };
}
