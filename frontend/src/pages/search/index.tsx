import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/router";
import { useGlobalSearch } from "@/hooks";
import { SearchBar } from "@/components/ui/SearchBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { SearchX, Users, MessageSquare } from "lucide-react";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { Conversation, SearchMessageResult } from "@/types";

const STATUS_BADGE: Record<string, "success" | "warning" | "default"> = {
  active: "success",
  human_takeover: "warning",
  closed: "default",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  human_takeover: "Takeover",
  closed: "Cerrada",
};

function ConversationCard({
  conversation,
  onSelect,
}: {
  conversation: Conversation;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
            {conversation.contact_name}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Badge variant={STATUS_BADGE[conversation.status] ?? "default"}>
              {STATUS_LABELS[conversation.status] ?? conversation.status}
            </Badge>
            <time
              dateTime={conversation.last_message_at ?? undefined}
              className="text-xs text-gray-400 dark:text-gray-500"
            >
              {formatRelativeTime(conversation.last_message_at)}
            </time>
          </span>
        </div>
        {conversation.last_message_preview && (
          <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
            {conversation.last_message_preview}
          </p>
        )}
      </button>
    </li>
  );
}

function MessageCard({
  message,
  onSelect,
}: {
  message: SearchMessageResult;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
            {message.contact_name}
          </span>
          <time
            dateTime={message.created_at}
            className="shrink-0 text-xs text-gray-400 dark:text-gray-500"
          >
            {formatRelativeTime(message.created_at)}
          </time>
        </div>
        <p className="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">
          <span className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/40">
            {message.highlight}
          </span>
        </p>
      </button>
    </li>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const urlQuery = typeof router.query.q === "string" ? router.query.q : "";
  const [input, setInput] = useState(urlQuery);
  const { results, loading, error, query, setQuery, retry } = useGlobalSearch();

  useEffect(() => {
    setInput(urlQuery);
    if (urlQuery) setQuery(urlQuery);
  }, [urlQuery]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    if (q !== urlQuery) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    } else {
      setQuery(q);
    }
  }

  const hasResults = Boolean(
    results &&
      (results.conversations.items.length > 0 || results.messages.items.length > 0)
  );
  const empty = results !== null && !hasResults;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-50">
        Búsqueda global
      </h1>

      <form onSubmit={handleSubmit} role="search" className="mb-8 max-w-xl">
        <SearchBar
          value={input}
          onChange={setInput}
          ariaLabel="Buscar conversaciones y mensajes"
          placeholder="Buscar conversaciones y mensajes..."
        />
      </form>

      {error ? (
        <ErrorState title="Error al buscar" message={error} onRetry={retry} />
      ) : loading && !results ? (
        <div className="space-y-8">
          {[0, 1].map((section) => (
            <div key={section} className="space-y-3">
              <Skeleton variant="title" width="180px" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="row" />
              ))}
            </div>
          ))}
        </div>
      ) : empty ? (
        <EmptyState
          icon={SearchX}
          title={`Sin resultados para "${query}"`}
          description="Prueba con otros términos o con una búsqueda diferente."
        />
      ) : results ? (
        <div className="space-y-10">
          {results.conversations.items.length > 0 && (
            <section aria-label="Conversaciones encontradas">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-50">
                <Users className="h-5 w-5 text-gray-400" aria-hidden="true" />
                Conversaciones
                <Badge variant="info">{results.conversations.total}</Badge>
              </h2>
              <ul className="space-y-2">
                {results.conversations.items.map((conversation) => (
                  <ConversationCard
                    key={conversation.id}
                    conversation={conversation}
                    onSelect={() => router.push(`/conversations/${conversation.id}`)}
                  />
                ))}
              </ul>
            </section>
          )}

          {results.messages.items.length > 0 && (
            <section aria-label="Mensajes encontrados">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-50">
                <MessageSquare className="h-5 w-5 text-gray-400" aria-hidden="true" />
                Mensajes
                <Badge variant="info">{results.messages.total}</Badge>
              </h2>
              <ul className="space-y-2">
                {results.messages.items.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    onSelect={() =>
                      router.push(`/conversations/${message.conversation_id}?msg=${message.id}`)
                    }
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
