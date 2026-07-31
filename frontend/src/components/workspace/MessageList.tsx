import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Message } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  searchActive?: boolean;
  searchQuery?: string;
  scrollToMessageId?: string;
}

export function MessageList({
  messages,
  loading,
  hasMore,
  onLoadMore,
  searchActive = false,
  searchQuery = "",
  scrollToMessageId = "",
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const scrolledToRef = useRef<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!scrollToMessageId || loading) return;
    if (scrolledToRef.current === scrollToMessageId) return;
    const el = containerRef.current?.querySelector(
      `[data-message-id="${scrollToMessageId}"]`
    );
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    setHighlightedMessageId(scrollToMessageId);
    scrolledToRef.current = scrollToMessageId;
  }, [scrollToMessageId, loading, messages.length]);

  function handleLoadMore() {
    if (containerRef.current) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
      isLoadingMoreRef.current = true;
    }
    onLoadMore();
  }

  useEffect(() => {
    const prevLength = prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (searchActive) {
      isLoadingMoreRef.current = false;
      return;
    }

    if (isLoadingMoreRef.current) {
      const container = containerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          const delta = container.scrollHeight - prevScrollHeightRef.current;
          container.scrollTop = delta;
        });
      }
      isLoadingMoreRef.current = false;
      return;
    }

    if (prevLength === 0 && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (messages.length > prevLength && prevLength > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, searchActive]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 space-y-3 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="row" />
        ))}
      </div>
    );
  }

  if (!loading && messages.length === 0) {
    if (searchActive) {
      return (
        <div className="flex-1 p-6">
          <EmptyState
            icon={MessageSquare}
            title={
              searchQuery
                ? `Sin resultados para "${searchQuery}"`
                : "No hay mensajes que coincidan"
            }
            description="Prueba con otros términos o cambia los filtros."
          />
        </div>
      );
    }
    return (
      <div className="flex-1 p-6">
        <EmptyState
          icon={MessageSquare}
          title="No hay mensajes"
          description="Esta conversación no tiene mensajes todavía."
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-6"
      role="log"
      aria-live="polite"
      aria-label="Mensajes de la conversación"
    >
      {hasMore && (
        <div className="mb-4 text-center">
          <Button variant="ghost" size="sm" onClick={handleLoadMore} disabled={loading}>
            Cargar más mensajes
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            highlight={highlightedMessageId === msg.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
