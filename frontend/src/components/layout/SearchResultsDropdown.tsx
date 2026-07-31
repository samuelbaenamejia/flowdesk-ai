import { ArrowRight, MessageSquare, SearchX, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type {
  Conversation,
  GlobalSearchResponse,
  SearchMessageResult,
} from "@/types";

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

export type SearchItem =
  | { kind: "conversation"; conversation: Conversation }
  | { kind: "message"; message: SearchMessageResult };

export function flattenSearchItems(
  results: GlobalSearchResponse | null
): SearchItem[] {
  if (!results) return [];
  return [
    ...results.conversations.items.map((conversation) => ({
      kind: "conversation" as const,
      conversation,
    })),
    ...results.messages.items.map((message) => ({
      kind: "message" as const,
      message,
    })),
  ];
}

interface SearchResultsDropdownProps {
  query: string;
  results: GlobalSearchResponse | null;
  loading: boolean;
  activeIndex: number;
  onSelectConversation: (id: string) => void;
  onSelectMessage: (message: SearchMessageResult) => void;
  onViewAll: () => void;
  onMouseEnterOption?: (index: number) => void;
}

export function SearchResultsDropdown({
  query,
  results,
  loading,
  activeIndex,
  onSelectConversation,
  onSelectMessage,
  onViewAll,
  onMouseEnterOption,
}: SearchResultsDropdownProps) {
  if (loading && !results) {
    return (
      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </div>
    );
  }

  const conversations = results?.conversations;
  const messages = results?.messages;
  const hasResults = Boolean(
    conversations?.items.length || messages?.items.length
  );

  if (!hasResults) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <SearchX className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sin resultados para "{query}"
        </p>
      </div>
    );
  }

  const convItems = conversations?.items ?? [];
  const msgItems = messages?.items ?? [];
  const showViewAll =
    Boolean(conversations && conversations.total > convItems.length) ||
    Boolean(messages && messages.total > msgItems.length);

  let itemIndex = 0;

  function rowClass(index: number) {
    return `flex w-full cursor-pointer flex-col px-3 py-2 text-left ${
      index === activeIndex
        ? "bg-gray-100 dark:bg-gray-700"
        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
    }`;
  }

  return (
    <div
      role="listbox"
      id="global-search-results"
      aria-label="Resultados de búsqueda"
      className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      {convItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-700">
            <Users className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Conversaciones
            </span>
            <Badge variant="default">{conversations?.total ?? 0}</Badge>
          </div>
          <ul className="py-1">
            {convItems.map((conversation) => {
              const index = itemIndex++;
              return (
                <li
                  key={conversation.id}
                  role="option"
                  id={`global-search-option-${index}`}
                  aria-selected={index === activeIndex}
                  tabIndex={-1}
                  onClick={() => onSelectConversation(conversation.id)}
                  onMouseEnter={() => onMouseEnterOption?.(index)}
                  className={rowClass(index)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
                      {conversation.contact_name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant={STATUS_BADGE[conversation.status] ?? "default"}>
                        {STATUS_LABELS[conversation.status] ?? conversation.status}
                      </Badge>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatRelativeTime(conversation.last_message_at)}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {msgItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-700">
            <MessageSquare className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Mensajes
            </span>
            <Badge variant="default">{messages?.total ?? 0}</Badge>
          </div>
          <ul className="py-1">
            {msgItems.map((message) => {
              const index = itemIndex++;
              return (
                <li
                  key={message.id}
                  role="option"
                  id={`global-search-option-${index}`}
                  aria-selected={index === activeIndex}
                  tabIndex={-1}
                  onClick={() => onSelectMessage(message)}
                  onMouseEnter={() => onMouseEnterOption?.(index)}
                  className={rowClass(index)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
                      {message.contact_name}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(message.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-gray-300">
                    <span className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/40">
                      {message.highlight}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="flex w-full items-center justify-center gap-1 border-t border-gray-100 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Ver todos los resultados
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
