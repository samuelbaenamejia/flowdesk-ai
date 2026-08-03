import { Conversation } from "@/types";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Inbox } from "lucide-react";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

const STATUS_BADGE: Record<string, "success" | "warning" | "default"> = {
  active: "success",
  human_takeover: "warning",
  closed: "default",
};

const EMPTY_MESSAGES: Record<string, { title: string; description: string }> = {
  active: {
    title: "No hay conversaciones activas",
    description: "Vuelve más tarde o cambia el filtro",
  },
  human_takeover: {
    title: "No hay conversaciones en takeover",
    description: "Ninguna conversación necesita intervención humana",
  },
  closed: {
    title: "No hay conversaciones cerradas",
    description: "Todas las conversaciones están abiertas",
  },
};

const HEADERS = [
  { key: "contact", label: "Contacto" },
  { key: "status", label: "Estado" },
  { key: "preview", label: "Último mensaje", className: "hidden md:table-cell" },
  { key: "time", label: "", className: "hidden md:table-cell" },
];

interface ConversationTableProps {
  conversations: Conversation[];
  statusFilter: string;
  loading: boolean;
  searchQuery?: string;
  dateRangeActive?: boolean;
  onSelectConversation: (id: string) => void;
}

export function ConversationTable({
  conversations,
  statusFilter,
  loading,
  searchQuery = "",
  dateRangeActive = false,
  onSelectConversation,
}: ConversationTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="row" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    if (searchQuery || dateRangeActive) {
      return (
        <EmptyState
          icon={Inbox}
          title={
            searchQuery
              ? `Sin resultados para "${searchQuery}"`
              : "No hay conversaciones en el rango de fechas"
          }
          description="Prueba con otros términos o limpia los filtros."
        />
      );
    }
    const msg = EMPTY_MESSAGES[statusFilter] ?? {
      title: "No hay conversaciones",
      description: "Las conversaciones aparecerán cuando los clientes escriban.",
    };
    return <EmptyState icon={Inbox} title={msg.title} description={msg.description} />;
  }

  const rows = conversations.map((conv) => {
    const unreadCount = conv.unread_count ?? 0;
    return {
      contact: (
        <span className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
            {conv.contact_name}
          </span>
          {unreadCount > 0 && (
            <Badge
              variant="info"
              aria-label={`${unreadCount} mensajes no leídos`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </span>
      ),
      status: (
        <Badge variant={STATUS_BADGE[conv.status] ?? "default"}>
          {conv.status === "human_takeover" ? "Takeover" : conv.status === "active" ? "Activa" : "Cerrada"}
        </Badge>
      ),
      preview: (
        <span className="max-w-xs truncate text-sm text-gray-500 dark:text-gray-400 hidden md:block">
          {conv.last_message_preview || ""}
        </span>
      ),
      time: (
        <span className="whitespace-nowrap text-sm text-gray-400 dark:text-gray-500 hidden md:block">
          {formatRelativeTime(conv.last_message_at)}
        </span>
      ),
    };
  });

  return (
    <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <Table
        headers={HEADERS}
        rows={rows}
        onRowClick={(i) => onSelectConversation(conversations[i].id)}
        getRowKey={(_, i) => conversations[i].id}
      />
    </div>
  );
}
