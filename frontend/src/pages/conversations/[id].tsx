import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getConversation, getConversationMessages } from "@/lib/api";
import { Conversation, Message } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  human_takeover: "bg-yellow-100 text-yellow-800",
  closed: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  human_takeover: "Takeover",
  closed: "Cerrada",
};

const MESSAGE_LIMIT = 50;

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConversationDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!id || typeof id !== "string") return;

    async function fetchConversation() {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const data = await getConversation(id as string);
        setConversation(data);
      } catch (err) {
        if (err instanceof Error && err.message.includes("404")) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchConversation();
  }, [id]);

  useEffect(() => {
    if (!id || typeof id !== "string") return;

    async function fetchMessages() {
      setLoadingMessages(true);
      try {
        const data = await getConversationMessages(id as string, {
          limit: MESSAGE_LIMIT,
          offset,
        });
        setMessages(data);
        setHasMore(data.length === MESSAGE_LIMIT);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar mensajes");
      } finally {
        setLoadingMessages(false);
      }
    }

    fetchMessages();
  }, [id, offset]);

  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loadingMessages, messages]);

  function handleBack() {
    router.push("/conversations");
  }

  function handleLoadMore() {
    setOffset((prev) => prev + MESSAGE_LIMIT);
  }

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-gray-200"
            />
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <div className="mb-6">
          <button
            type="button"
            onClick={handleBack}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Volver
          </button>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">Conversación no encontrada</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Volver a conversaciones
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <button
            type="button"
            onClick={handleBack}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Volver
          </button>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Volver
        </button>

        {conversation && (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {conversation.contact_name}
              </h2>
              <p className="text-sm text-gray-500">
                {formatDateTime(conversation.created_at)}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[conversation.status] || "bg-gray-100 text-gray-800"}`}
            >
              {STATUS_LABELS[conversation.status] || conversation.status}
            </span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {loadingMessages ? (
          <div className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-gray-100"
                />
              ))}
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No hay mensajes en esta conversación</p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto p-6">
            {hasMore && (
              <div className="mb-4 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Cargar más
                </button>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      msg.direction === "outgoing"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {msg.content}
                    </p>
                    <div
                      className={`mt-1 flex items-center gap-2 text-xs ${
                        msg.direction === "outgoing"
                          ? "text-blue-100"
                          : "text-gray-500"
                      }`}
                    >
                      <span>{formatTime(msg.created_at)}</span>
                      {msg.direction === "outgoing" && (
                        <span className="capitalize">{msg.status}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
