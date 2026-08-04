import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useConversations } from "@/hooks/useConversations";
import { ConversationTable } from "@/components/dashboard/ConversationTable";
import { ConversationFilters } from "@/components/dashboard/ConversationFilters";
import { Pagination } from "@/components/dashboard/Pagination";
import { ErrorState } from "@/components/ui/ErrorState";

export default function ConversationsPage() {
  const router = useRouter();
  const {
    conversations,
    total,
    loading,
    error,
    statusFilter,
    search,
    dateFrom,
    dateTo,
    offset,
    hasMore,
    setStatusFilter,
    setSearch,
    setDateFrom,
    setDateTo,
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

  function handleClearFilters() {
    setSearch("");
    setStatusFilter("");
    setDateFrom(null);
    setDateTo(null);
  }

  return (
    <div>
      <Head>
        <title>Conversaciones | FlowDesk</title>
      </Head>
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-50">Conversaciones</h2>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <>
          <div className="mb-4">
            <ConversationFilters
              search={search}
              statusFilter={statusFilter}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onSearchChange={setSearch}
              onStatusChange={setStatusFilter}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onClear={handleClearFilters}
            />
          </div>

          <ConversationTable
            conversations={conversations}
            statusFilter={statusFilter}
            loading={loading}
            searchQuery={search}
            dateRangeActive={Boolean(dateFrom || dateTo)}
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
                total={total}
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
