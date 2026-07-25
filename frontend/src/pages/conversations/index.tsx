import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getConversations } from "@/lib/api";
import { Conversation } from "@/types";

const STATUS_OPTIONS = [
  { label: "Todas", value: "" },
  { label: "Activas", value: "active" },
  { label: "Takeover", value: "human_takeover" },
  { label: "Cerradas", value: "closed" },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  human_takeover: "bg-yellow-100 text-yellow-800",
  closed: "bg-gray-100 text-gray-800",
};

const LIMIT = 20;

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays}d`;
}

export default function ConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    async function fetchConversations() {
      setLoading(true);
      setError(null);
      try {
        const data = await getConversations({
          status: statusFilter || undefined,
          limit: LIMIT,
          offset,
        });
        setConversations(data);
        setHasMore(data.length === LIMIT);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    }
    fetchConversations();
  }, [statusFilter, offset]);

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setOffset(0);
  }

  function handlePrevious() {
    setOffset((prev) => Math.max(0, prev - LIMIT));
  }

  function handleNext() {
    setOffset((prev) => prev + LIMIT);
  }

  function handleRowClick(conversationId: string) {
    router.push(`/conversations/${conversationId}`);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Conversaciones</h2>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <label htmlFor="status-filter" className="text-sm text-gray-600">
          Filtrar por estado:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-gray-200"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && conversations.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">No hay conversaciones aun</p>
        </div>
      )}

      {!loading && !error && conversations.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Ultimo mensaje
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Ultima actividad
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {conversations.map((conv) => (
                  <tr
                    key={conv.id}
                    onClick={() => handleRowClick(conv.id)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {conv.contact_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[conv.status] || "bg-gray-100 text-gray-800"}`}
                      >
                        {conv.status}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-500">
                      {conv.last_message_preview || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatDate(conv.last_message_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={offset === 0}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-500">
              {offset + 1} - {Math.min(offset + LIMIT, offset + conversations.length)}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasMore}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  );
}
