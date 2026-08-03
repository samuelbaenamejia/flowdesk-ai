import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useChatShortcuts, useConversation, useMessages } from "@/hooks";
import { markConversationRead } from "@/lib/api";
import { ConversationHeader } from "@/components/workspace/ConversationHeader";
import { MessageFilters } from "@/components/workspace/MessageFilters";
import { MessageList } from "@/components/workspace/MessageList";
import { Composer } from "@/components/workspace/Composer";
import { FloatingScrollButton } from "@/components/conversations/FloatingScrollButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MessageSquare } from "lucide-react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function ConversationDetailPage() {
  const router = useRouter();
  const { id, msg } = router.query;
  const conversationId = typeof id === "string" ? id : undefined;
  const scrollToMessageId = typeof msg === "string" ? msg : undefined;

  const {
    conversation,
    loading: conversationLoading,
    error: conversationError,
    notFound,
    toggleStatus,
    toggling,
    toggleError,
  } = useConversation(conversationId);

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    total,
    search,
    directionFilter,
    statusFilter,
    dateFrom,
    dateTo,
    hasMore,
    setSearch,
    setDirectionFilter,
    setStatusFilter,
    setDateFrom,
    setDateTo,
    loadMore,
    sendMessage,
    sending,
    sendError,
  } = useMessages(conversationId);

  const hasActiveFilters = Boolean(
    search || directionFilter || statusFilter || dateFrom || dateTo
  );

  const { searchOpen, setSearchOpen, searchInputRef } = useChatShortcuts(hasActiveFilters);
  const clearFiltersRef = useRef(() => {});
  const messageListRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const [nearBottom, setNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  useEffect(() => {
    if (!conversationId) return;
    markConversationRead(conversationId).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (nearBottom) {
      if (newMessagesCount !== 0) {
        setNewMessagesCount(0);
      }
      return;
    }

    if (messages.length > prevLength) {
      const incomingNew = messages
        .slice(prevLength)
        .filter((msg) => msg.direction === "incoming").length;
      if (incomingNew > 0) {
        setNewMessagesCount((count) => count + incomingNew);
      }
    }
  }, [messages.length, nearBottom, newMessagesCount]);

  useEffect(() => {
    if (hasActiveFilters) {
      setNewMessagesCount(0);
    }
  }, [hasActiveFilters]);

  function handleNearBottomChange(isNearBottom: boolean) {
    setNearBottom(isNearBottom);
    if (isNearBottom) {
      setNewMessagesCount(0);
    }
  }

  function handleScrollToBottom() {
    const container = messageListRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
    setNewMessagesCount(0);
  }

  function handleBack() {
    router.push("/conversations");
  }

  function handleClearFilters() {
    setSearch("");
    setDirectionFilter("");
    setStatusFilter("");
    setDateFrom(null);
    setDateTo(null);
    setSearchOpen(false);
  }

  clearFiltersRef.current = handleClearFilters;

  useEffect(() => {
    if (!searchOpen) {
      clearFiltersRef.current();
    }
  }, [searchOpen]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setSearchOpen(Boolean(value));
  }

  if (conversationLoading) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <Skeleton variant="text" width="80px" />
            <div>
              <Skeleton variant="title" />
              <Skeleton variant="text" width="120px" />
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-3 p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="row" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800">
        <EmptyState
          icon={MessageSquare}
          title="Conversación no encontrada"
          description="La conversación que buscas no existe o fue eliminada."
          action={{ label: "Volver a conversaciones", onClick: handleBack }}
        />
      </div>
    );
  }

  if (conversationError || messagesError) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800">
        <ErrorState
          title="Error al cargar la conversación"
          message={conversationError || messagesError || "Error desconocido"}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  const showComposer = conversation.status === "human_takeover";

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {toggleError && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400" role="alert">
          {toggleError}
        </div>
      )}

      <ConversationHeader
        conversation={conversation}
        onBack={handleBack}
        onToggleStatus={toggleStatus}
        toggling={toggling}
      />

      <MessageFilters
        search={search}
        directionFilter={directionFilter}
        statusFilter={statusFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onSearchChange={handleSearchChange}
        onDirectionChange={setDirectionFilter}
        onStatusChange={setStatusFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onClear={handleClearFilters}
        resultCount={messages.length}
        totalResults={total}
        searchInputRef={searchInputRef}
      />

      <div className="relative min-h-0 flex-1">
        <MessageList
          ref={messageListRef}
          messages={messages}
          loading={messagesLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          searchActive={hasActiveFilters}
          searchQuery={search}
          scrollToMessageId={scrollToMessageId}
          onNearBottomChange={handleNearBottomChange}
        />
        <FloatingScrollButton
          visible={!nearBottom && !hasActiveFilters}
          count={newMessagesCount}
          onClick={handleScrollToBottom}
        />
      </div>

      {showComposer && (
        <Composer
          onSend={sendMessage}
          disabled={toggling}
          sending={sending}
          error={sendError}
        />
      )}
    </div>
  );
}
