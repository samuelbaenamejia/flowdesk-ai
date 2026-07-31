import { Message } from "@/types";
import { formatTime } from "@/lib/formatTime";

const STATUS_TRANSLATIONS: Record<string, string> = {
  sent: "enviado",
  delivered: "entregado",
  read: "leído",
  failed: "fallido",
};

interface MessageBubbleProps {
  message: Message;
  highlight?: boolean;
}

export function MessageBubble({ message, highlight = false }: MessageBubbleProps) {
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
          {message.content}
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
