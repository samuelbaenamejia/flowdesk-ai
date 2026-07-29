import { useRouter } from "next/router";
import { useConversation, useMessages } from "@/hooks";
import { ConversationHeader } from "@/components/workspace/ConversationHeader";
import { MessageList } from "@/components/workspace/MessageList";
import { Composer } from "@/components/workspace/Composer";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MessageSquare } from "lucide-react";

export default function ConversationDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const conversationId = typeof id === "string" ? id : undefined;

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
    hasMore,
    loadMore,
    sendMessage,
    sending,
    sendError,
  } = useMessages(conversationId);

  function handleBack() {
    router.push("/conversations");
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

      <MessageList
        messages={messages}
        loading={messagesLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />

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
