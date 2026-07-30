import { useEffect, useState, useCallback, useRef } from "react";
import { getContacts, getTags } from "@/lib/api";
import { Contact, Tag } from "@/types";

const LIMIT = 25;

interface UseContactsReturn {
  contacts: Contact[];
  total: number;
  loading: boolean;
  error: string | null;
  search: string;
  offset: number;
  hasMore: boolean;
  tags: Tag[];
  tagsLoading: boolean;
  setSearch: (value: string) => void;
  handlePrevious: () => void;
  handleNext: () => void;
  retry: () => void;
}

export function useContacts(): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearchState] = useState("");
  const [offset, setOffset] = useState(0);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (signal: AbortSignal, q: string, off: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContacts({ q: q || undefined, limit: LIMIT, offset: off }, signal);
      if (!signal.aborted) {
        setContacts(data.items);
        setTotal(data.total);
      }
    } catch (err) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : "Error al cargar contactos");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async (signal: AbortSignal) => {
    try {
      const data = await getTags(signal);
      if (!signal.aborted) setTags(data);
    } catch {
      if (signal.aborted) return;
    } finally {
      if (!signal.aborted) setTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal, search, offset);
    return () => controller.abort();
  }, [fetchData, search, offset]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTags(controller.signal);
    return () => controller.abort();
  }, [fetchTags]);

  function setSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchState(value);
      setOffset(0);
    }, 300);
  }

  function handlePrevious() {
    setOffset((prev) => Math.max(0, prev - LIMIT));
  }

  function handleNext() {
    setOffset((prev) => prev + LIMIT);
  }

  function retry() {
    const controller = new AbortController();
    fetchData(controller.signal, search, offset);
  }

  return {
    contacts,
    total,
    loading,
    error,
    search,
    offset,
    hasMore: offset + LIMIT < total,
    tags,
    tagsLoading,
    setSearch,
    handlePrevious,
    handleNext,
    retry,
  };
}
