import { useEffect, useRef } from "react";
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
}

export function MessageList({
  messages,
  loading,
  hasMore,
  onLoadMore,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

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
  }, [messages.length]);

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
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
