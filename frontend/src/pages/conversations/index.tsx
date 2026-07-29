import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useConversations } from "@/hooks/useConversations";
import { ConversationTable } from "@/components/dashboard/ConversationTable";
import { ConversationsFilter } from "@/components/dashboard/ConversationsFilter";
import { Pagination } from "@/components/dashboard/Pagination";
import { ErrorState } from "@/components/ui/ErrorState";

export default function ConversationsPage() {
  const router = useRouter();
  const {
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
  } = useConversations();

  const [announcement, setAnnouncement] = useState("");
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    if (!hasLoadedOnce.current) {
      if (loading) {
        setAnnouncement("Cargando conversaciones");
      } else if (!error) {
        hasLoadedOnce.current = true;
        setAnnouncement(
          conversations.length > 0
            ? `${conversations.length} conversaciones cargadas`
            : "No hay conversaciones"
        );
      }
    }
  }, [loading, error, conversations.length]);

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-50">Conversaciones</h2>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <>
          <div className="mb-4">
            <ConversationsFilter value={statusFilter} onChange={setStatusFilter} />
          </div>

          <ConversationTable
            conversations={conversations}
            statusFilter={statusFilter}
            loading={loading}
            onSelectConversation={(id) => router.push(`/conversations/${id}`)}
          />

          {conversations.length > 0 && (
            <div className="mt-4">
              <Pagination
                offset={offset}
                limit={20}
                hasMore={hasMore}
                loading={loading}
                count={conversations.length}
                onPrevious={handlePrevious}
                onNext={handleNext}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
