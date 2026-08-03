import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
} from "react";
import { MessageSquare } from "lucide-react";
import { Message } from "@/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { DateGroup, getDateGroupKey } from "@/components/conversations/DateGroup";
import { MessageBubble } from "./MessageBubble";

const NEAR_BOTTOM_THRESHOLD_PX = 120;

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  searchActive?: boolean;
  searchQuery?: string;
  scrollToMessageId?: string;
  onNearBottomChange?: (nearBottom: boolean) => void;
}

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  function MessageList(
    {
      messages,
      loading,
      hasMore,
      onLoadMore,
      searchActive = false,
      searchQuery = "",
      scrollToMessageId = "",
      onNearBottomChange,
    },
    ref: ForwardedRef<HTMLDivElement>
  ) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const prevLengthRef = useRef(messages.length);
    const prevScrollHeightRef = useRef(0);
    const isLoadingMoreRef = useRef(false);
    const scrolledToRef = useRef<string | null>(null);
    const nearBottomRef = useRef(true);
    const rafRef = useRef<number | null>(null);
    const onNearBottomChangeRef = useRef(onNearBottomChange);
    onNearBottomChangeRef.current = onNearBottomChange;
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
    const [nearBottom, setNearBottom] = useState(true);

    function setRefs(node: HTMLDivElement | null) {
      listRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }

    function handleScroll() {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const container = listRef.current;
        if (!container) return;
        const isNearBottom =
          container.scrollTop + container.clientHeight >=
          container.scrollHeight - NEAR_BOTTOM_THRESHOLD_PX;
        nearBottomRef.current = isNearBottom;
        setNearBottom(isNearBottom);
        onNearBottomChangeRef.current?.(isNearBottom);
      });
    }

    const groups = useMemo(() => {
      if (searchActive) return [];
      const grouped = new Map<string, Message[]>();
      for (const msg of messages) {
        const key = getDateGroupKey(new Date(msg.created_at));
        const bucket = grouped.get(key);
        if (bucket) {
          bucket.push(msg);
        } else {
          grouped.set(key, [msg]);
        }
      }
      return Array.from(grouped, ([key, groupMessages]) => ({ key, messages: groupMessages }));
    }, [messages, searchActive]);

    function toggleGroup(dateKey: string) {
      setCollapsedDates((prev) => {
        const next = new Set(prev);
        if (next.has(dateKey)) {
          next.delete(dateKey);
        } else {
          next.add(dateKey);
        }
        return next;
      });
    }

    useEffect(() => {
      if (!scrollToMessageId || loading) return;
      if (scrolledToRef.current === scrollToMessageId) return;
      const target = messages.find((msg) => msg.id === scrollToMessageId);
      if (target) {
        const key = getDateGroupKey(new Date(target.created_at));
        setCollapsedDates((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
      const el = listRef.current?.querySelector(
        `[data-message-id="${scrollToMessageId}"]`
      );
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      setHighlightedMessageId(scrollToMessageId);
      scrolledToRef.current = scrollToMessageId;
    }, [scrollToMessageId, loading, messages.length, collapsedDates]);

    function handleLoadMore() {
      if (listRef.current) {
        prevScrollHeightRef.current = listRef.current.scrollHeight;
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
        const container = listRef.current;
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

      if (messages.length > prevLength && prevLength > 0 && nearBottomRef.current) {
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
        ref={setRefs}
        className="flex-1 overflow-y-auto p-6"
        role="log"
        aria-live="polite"
        aria-label="Mensajes de la conversación"
        onScroll={handleScroll}
      >
        {hasMore && (
          <div className="mb-4 text-center">
            <Button variant="ghost" size="sm" onClick={handleLoadMore} disabled={loading}>
              Cargar más mensajes
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {searchActive
            ? messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  highlight={highlightedMessageId === msg.id}
                  highlightTerm={searchQuery}
                />
              ))
            : groups.map((group) => (
                <DateGroup
                  key={group.key}
                  dateKey={group.key}
                  count={group.messages.length}
                  collapsed={collapsedDates.has(group.key)}
                  onToggle={() => toggleGroup(group.key)}
                >
                  {group.messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      highlight={highlightedMessageId === msg.id}
                      highlightTerm={searchQuery}
                    />
                  ))}
                </DateGroup>
              ))}
          <div ref={bottomRef} />
        </div>
      </div>
    );
  }
);
