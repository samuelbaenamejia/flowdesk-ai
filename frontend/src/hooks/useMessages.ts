import { useEffect, useState, useCallback, useRef } from "react";
import { getConversationMessages, sendMessage as apiSendMessage } from "@/lib/api";
import { GetMessagesParams, Message, MessageFilters } from "@/types";

const LIMIT = 50;
const POLL_INTERVAL = 5000;
const SEARCH_DEBOUNCE_MS = 300;

interface UseMessagesReturn {
  messages: Message[];
  total: number;
  offset: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  search: string;
  directionFilter: string;
  statusFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
  filters: MessageFilters;
  setSearch: (value: string) => void;
  setDirectionFilter: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setDateFrom: (value: string | null) => void;
  setDateTo: (value: string | null) => void;
  loadMore: () => void;
  sendMessage: (content: string) => Promise<void>;
  sending: boolean;
  sendError: string | null;
}

export function useMessages(conversationId: string | undefined): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [search, setSearchState] = useState("");
  const [directionFilter, setDirectionFilterState] = useState("");
  const [statusFilter, setStatusFilterState] = useState("");
  const [dateFrom, setDateFromState] = useState<string | null>(null);
  const [dateTo, setDateToState] = useState<string | null>(null);
  const lastFetchRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters = Boolean(
    search || directionFilter || statusFilter || dateFrom || dateTo
  );

  useEffect(() => {
    if (!conversationId) return;
    const cid = conversationId;

    const controller = new AbortController();

    async function fetchMessages() {
      setLoading(true);
      setError(null);
      try {
        const params: GetMessagesParams = { limit: LIMIT, offset };
        if (search) params.q = search;
        if (directionFilter) {
          params.direction = directionFilter as "incoming" | "outgoing";
        }
        if (statusFilter) params.status = statusFilter;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;

        const data = await getConversationMessages(cid, params, controller.signal);
        if (!controller.signal.aborted) {
          if (offset === 0) {
            setMessages(data.items);
          } else {
            setMessages((prev) => [...data.items, ...prev]);
          }
          setTotal(data.total);
          if (data.items.length > 0) {
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
  }, [conversationId, offset, search, directionFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!conversationId || hasActiveFilters) return;

    function poll() {
      if (document.visibilityState !== "visible") return;
      const after = lastFetchRef.current;
      if (!after) return;
      getConversationMessages(conversationId!, { after, limit: LIMIT })
        .then((data) => {
          if (data.items.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const unique = data.items.filter((m) => !existingIds.has(m.id));
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
  }, [conversationId, hasActiveFilters]);

  const loadMore = useCallback(() => {
    setOffset((prev) => prev + LIMIT);
  }, []);

  function setSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchState(value);
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
  }

  function setDirectionFilter(value: string) {
    setDirectionFilterState(value);
    setOffset(0);
  }

  function setStatusFilter(value: string) {
    setStatusFilterState(value);
    setOffset(0);
  }

  function setDateFrom(value: string | null) {
    setDateFromState(value);
    setOffset(0);
  }

  function setDateTo(value: string | null) {
    setDateToState(value);
    setOffset(0);
  }

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

  return {
    messages,
    total,
    offset,
    loading,
    error,
    hasMore: offset + messages.length < total,
    search,
    directionFilter,
    statusFilter,
    dateFrom,
    dateTo,
    filters: {
      q: search,
      direction: directionFilter,
      status: statusFilter,
      date_from: dateFrom,
      date_to: dateTo,
    },
    setSearch,
    setDirectionFilter,
    setStatusFilter,
    setDateFrom,
    setDateTo,
    loadMore,
    sendMessage,
    sending,
    sendError,
  };
}
