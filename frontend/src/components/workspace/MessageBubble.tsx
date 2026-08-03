import { type ReactNode } from "react";
import { Message } from "@/types";
import { formatTime } from "@/lib/formatTime";

const STATUS_TRANSLATIONS: Record<string, string> = {
  sent: "enviado",
  delivered: "entregado",
  read: "leído",
  failed: "fallido",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedContent(content: string, term: string): ReactNode {
  if (!term) return content;
  let regex: RegExp;
  try {
    regex = new RegExp(escapeRegExp(term), "gi");
  } catch {
    return content;
  }
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(regex)) {
    if (match.index === undefined) continue;
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(<mark key={`${match.index}-${match[0]}`}>{match[0]}</mark>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  return parts.length > 0 ? parts : content;
}

interface MessageBubbleProps {
  message: Message;
  highlight?: boolean;
  highlightTerm?: string;
}

export function MessageBubble({
  message,
  highlight = false,
  highlightTerm = "",
}: MessageBubbleProps) {
  const isOutbound = message.direction === "outgoing";
  const isFailed = message.status === "failed";
  const ringClass = highlight
    ? "ring-2 ring-amber-300 dark:ring-amber-500"
    : isFailed
      ? "ring-2 ring-red-400 dark:ring-red-500"
      : "";

  return (
    <div
      className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
      data-message-id={message.id}
    >
      <div
        className={`max-w-[85%] md:max-w-[70%] rounded-lg px-4 py-2 ${
          isOutbound
            ? "bg-blue-600 text-white dark:bg-blue-700 dark:text-gray-100"
            : "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
        } ${ringClass}`}
      >
        <p className="whitespace-pre-wrap break-words text-sm">
          {renderHighlightedContent(message.content, highlightTerm)}
        </p>
        <div
          className={`mt-1 flex items-center gap-2 text-xs ${
            isOutbound ? "text-blue-100 dark:text-blue-200" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <time dateTime={message.created_at}>
            {formatTime(message.created_at)}
          </time>
          {isOutbound && (
            <span className="capitalize">
              {STATUS_TRANSLATIONS[message.status] || message.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
