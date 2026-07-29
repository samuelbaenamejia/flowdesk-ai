import { ArrowLeft } from "lucide-react";
import { Conversation } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/formatTime";

const STATUS_TO_BADGE: Record<string, "success" | "warning" | "default"> = {
  active: "success",
  human_takeover: "warning",
  closed: "default",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  human_takeover: "Takeover",
  closed: "Cerrada",
};

interface ConversationHeaderProps {
  conversation: Conversation;
  onBack: () => void;
  onToggleStatus: () => void;
  toggling: boolean;
}

export function ConversationHeader({
  conversation,
  onBack,
  onToggleStatus,
  toggling,
}: ConversationHeaderProps) {
  const isTakeover = conversation.status === "human_takeover";
  const badgeVariant = STATUS_TO_BADGE[conversation.status] || "default";

  return (
    <div className="flex flex-wrap gap-2 items-start md:items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2 md:gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-label="Volver a conversaciones"
          className="shrink-0"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver
        </Button>
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-50">
            {conversation.contact_name}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Creado: {formatDateTime(conversation.created_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <Badge variant={badgeVariant}>
          {STATUS_LABELS[conversation.status] || conversation.status}
        </Badge>

        {conversation.status !== "closed" && (
          <Button
            variant={isTakeover ? "secondary" : "primary"}
            size="sm"
            onClick={onToggleStatus}
            disabled={toggling}
            aria-label={
              isTakeover
                ? "Devolver control al bot"
                : "Tomar control de la conversación"
            }
          >
            {toggling
              ? "Cambiando..."
              : isTakeover
                ? "Devolver"
                : "Control"}
          </Button>
        )}
      </div>
    </div>
  );
}
