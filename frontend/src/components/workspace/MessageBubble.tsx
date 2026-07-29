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
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === "outgoing";
  const isFailed = message.status === "failed";

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] md:max-w-[70%] rounded-lg px-4 py-2 ${
          isOutbound
            ? isFailed
              ? "bg-blue-600 text-white ring-2 ring-red-400 dark:bg-blue-700 dark:text-gray-100 dark:ring-red-500"
              : "bg-blue-600 text-white dark:bg-blue-700 dark:text-gray-100"
            : "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
        }`}
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
