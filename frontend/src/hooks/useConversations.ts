import { useEffect, useState, useCallback, useRef } from "react";
import { getConversations } from "@/lib/api";
import { Conversation, ConversationFilters } from "@/types";

const LIMIT = 20;
const POLL_INTERVAL = 10000;
const SEARCH_DEBOUNCE_MS = 300;

interface UseConversationsReturn {
  conversations: Conversation[];
  total: number;
  loading: boolean;
  error: string | null;
  statusFilter: string;
  search: string;
  dateFrom: string | null;
  dateTo: string | null;
  filters: ConversationFilters;
  offset: number;
  hasMore: boolean;
  setStatusFilter: (value: string) => void;
  setSearch: (value: string) => void;
  setDateFrom: (value: string | null) => void;
  setDateTo: (value: string | null) => void;
  handlePrevious: () => void;
  handleNext: () => void;
  retry: () => void;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilterState] = useState("");
  const [search, setSearchState] = useState("");
  const [dateFrom, setDateFromState] = useState<string | null>(null);
  const [dateTo, setDateToState] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters = Boolean(
    search || statusFilter || dateFrom || dateTo
  );

  const fetchData = useCallback(async (signal: AbortSignal, q: string, st: string, from: string | null, to: string | null, off: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getConversations(
        {
          q: q || undefined,
          status: st || undefined,
          date_from: from || undefined,
          date_to: to || undefined,
          limit: LIMIT,
          offset: off,
        },
        signal
      );
      if (!signal.aborted) {
        setConversations(data.items);
        setTotal(data.total);
      }
    } catch (err) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : "Error al cargar conversaciones");
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal, search, statusFilter, dateFrom, dateTo, offset);
    return () => controller.abort();
  }, [fetchData, search, statusFilter, dateFrom, dateTo, offset]);

  useEffect(() => {
    if (hasActiveFilters) return;

    const controller = new AbortController();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData(controller.signal, search, statusFilter, dateFrom, dateTo, offset);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const intervalId = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const ctrl = new AbortController();
      fetchData(ctrl.signal, search, statusFilter, dateFrom, dateTo, offset);
    }, POLL_INTERVAL);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      controller.abort();
      clearInterval(intervalId);
    };
  }, [fetchData, hasActiveFilters, search, statusFilter, dateFrom, dateTo, offset]);

  function setStatusFilter(value: string) {
    setStatusFilterState(value);
    setOffset(0);
  }

  function setSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchState(value);
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
  }

  function setDateFrom(value: string | null) {
    setDateFromState(value);
    setOffset(0);
  }

  function setDateTo(value: string | null) {
    setDateToState(value);
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
    fetchData(controller.signal, search, statusFilter, dateFrom, dateTo, offset);
  }

  return {
    conversations,
    total,
    loading,
    error,
    statusFilter,
    search,
    dateFrom,
    dateTo,
    filters: { q: search, status: statusFilter, date_from: dateFrom, date_to: dateTo },
    offset,
    hasMore: offset + conversations.length < total,
    setStatusFilter,
    setSearch,
    setDateFrom,
    setDateTo,
    handlePrevious,
    handleNext,
    retry,
  };
}
