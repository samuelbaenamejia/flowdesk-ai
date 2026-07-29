import { useEffect, useState, useCallback, useRef } from "react";
import { getConversation, updateConversation } from "@/lib/api";
import { Conversation } from "@/types";

const POLL_INTERVAL = 15000;

interface UseConversationReturn {
  conversation: Conversation | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  toggleStatus: () => Promise<void>;
  toggling: boolean;
  toggleError: string | null;
}

export function useConversation(id: string | undefined): UseConversationReturn {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id) return;
    const conversationId = id;

    const controller = new AbortController();

    async function fetchConversation() {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const data = await getConversation(conversationId, controller.signal);
        if (!controller.signal.aborted) {
          setConversation(data);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.message.includes("404")) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchConversation();

    const intervalId = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      getConversation(conversationId, ctrl.signal)
        .then((data) => {
          if (!ctrl.signal.aborted) setConversation(data);
        })
        .catch(() => {});
    }, POLL_INTERVAL);

    return () => {
      controller.abort();
      clearInterval(intervalId);
      abortRef.current?.abort();
    };
  }, [id]);

  const toggleStatus = useCallback(async () => {
    if (!conversation || !id) return;
    if (conversation.status === "closed") return;

    setToggling(true);
    setToggleError(null);
    try {
      const newStatus =
        conversation.status === "active" ? "human_takeover" : "active";
      const updated = await updateConversation(id, newStatus);
      setConversation(updated);
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Error al cambiar estado");
    } finally {
      setToggling(false);
    }
  }, [conversation, id]);

  return { conversation, loading, error, notFound, toggleStatus, toggling, toggleError };
}
