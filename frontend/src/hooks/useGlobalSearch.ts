import { useEffect, useState, useRef } from "react";
import { globalSearch } from "@/lib/api";
import { GlobalSearchResponse } from "@/types";

const SEARCH_DEBOUNCE_MS = 300;
const MAX_CACHE_ENTRIES = 10;

interface UseGlobalSearchReturn {
  results: GlobalSearchResponse | null;
  loading: boolean;
  error: string | null;
  query: string;
  setQuery: (value: string) => void;
  clear: () => void;
  retry: () => void;
}

export function useGlobalSearch(): UseGlobalSearchReturn {
  const [query, setQueryState] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, GlobalSearchResponse>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(debouncedQuery);
    if (cached) {
      setResults(cached);
      setError(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    globalSearch({ q: debouncedQuery }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        cacheRef.current.set(debouncedQuery, data);
        if (cacheRef.current.size > MAX_CACHE_ENTRIES) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest !== undefined) cacheRef.current.delete(oldest);
        }
        setResults(data);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Error al buscar");
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, retryKey]);

  function setQuery(value: string) {
    setQueryState(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, SEARCH_DEBOUNCE_MS);
  }

  function clear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    setQueryState("");
    setDebouncedQuery("");
    setResults(null);
    setError(null);
    setLoading(false);
  }

  function retry() {
    if (!debouncedQuery) return;
    cacheRef.current.delete(debouncedQuery);
    setRetryKey((k) => k + 1);
  }

  return { results, loading, error, query, setQuery, clear, retry };
}
