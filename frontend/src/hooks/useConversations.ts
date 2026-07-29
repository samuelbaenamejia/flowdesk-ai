import { useEffect, useState, useCallback } from "react";
import { getConversations } from "@/lib/api";
import { Conversation } from "@/types";

const LIMIT = 20;
const POLL_INTERVAL = 10000;

interface UseConversationsReturn {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  statusFilter: string;
  offset: number;
  hasMore: boolean;
  setStatusFilter: (value: string) => void;
  handlePrevious: () => void;
  handleNext: () => void;
  retry: () => void;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilterState] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getConversations(
        { status: statusFilter || undefined, limit: LIMIT, offset },
        signal
      );
      if (!signal.aborted) {
        setConversations(data);
        setHasMore(data.length >= LIMIT);
      }
    } catch (err) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : "Error al cargar conversaciones");
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [statusFilter, offset]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  useEffect(() => {
    const controller = new AbortController();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData(controller.signal);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const intervalId = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const ctrl = new AbortController();
      fetchData(ctrl.signal);
    }, POLL_INTERVAL);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      controller.abort();
      clearInterval(intervalId);
    };
  }, [fetchData]);

  function setStatusFilter(value: string) {
    setStatusFilterState(value);
    setOffset(0);
  }

  function handlePrevious() {
    setOffset((prev) => Math.max(0, prev - LIMIT));
  }

  function handleNext() {
    setOffset((prev) => prev + LIMIT);
  }

  function retry() {
    const controller = new AbortController();
    fetchData(controller.signal);
  }

  return {
    conversations,
    loading,
    error,
    statusFilter,
    offset,
    hasMore,
    setStatusFilter,
    handlePrevious,
    handleNext,
    retry,
  };
}
