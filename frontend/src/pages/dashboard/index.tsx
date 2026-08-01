import { useRouter } from "next/router";
import { MessagesSquare, Clock, Inbox, ReplyAll, MessageSquare } from "lucide-react";
import { useDashboard } from "@/hooks";
import { StatCard } from "@/components/dashboard/StatCard";
import { MessagesChart } from "@/components/dashboard/MessagesChart";
import { ConversationTable } from "@/components/dashboard/ConversationTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

function formatNumber(value: number): string {
  const [integer, decimals] = String(value).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimals ? `${grouped}.${decimals}` : grouped;
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    stats,
    statsLoading,
    statsError,
    chart,
    chartLoading,
    chartError,
    recent,
    recentLoading,
    recentError,
    retryStats,
    retryChart,
    retryRecent,
  } = useDashboard();

  const isEmpty =
    stats !== null && stats.total_conversations === 0 && !statsLoading;

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-50">Dashboard</h2>

      {isEmpty ? (
        <EmptyState
          icon={MessageSquare}
          title="Empieza a conversar"
          description="Cuando tus clientes te escriban, aquí verás estadísticas y tendencias."
          action={{ label: "Crear contacto", onClick: () => router.push("/contacts") }}
        />
      ) : (
        <>
          <section aria-label="Métricas" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statsLoading && !stats ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="row" height="96px" />
              ))
            ) : statsError ? (
              <div className="sm:col-span-2 xl:col-span-4">
                <ErrorState message={statsError} onRetry={retryStats} />
              </div>
            ) : stats ? (
              <>
                <StatCard
                  label="Conversaciones totales"
                  value={formatNumber(stats.total_conversations)}
                  icon={Inbox}
                />
                <StatCard
                  label="Mensajes hoy"
                  value={formatNumber(stats.messages_today)}
                  icon={MessagesSquare}
                />
                <StatCard
                  label="Tasa de respuesta"
                  value={`${Math.round(stats.response_rate)}%`}
                  icon={ReplyAll}
                />
                <StatCard
                  label="Tiempo medio de respuesta"
                  value={`${stats.avg_response_time_minutes.toLocaleString("es-ES", {
                    maximumFractionDigits: 1,
                  })} min`}
                  icon={Clock}
                />
              </>
            ) : null}
          </section>

          <section
            aria-label="Mensajes por día"
            className="mt-8 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
              Mensajes por día
            </h3>
            {chartLoading && chart.length === 0 ? (
              <Skeleton variant="row" height="224px" />
            ) : chartError ? (
              <ErrorState message={chartError} onRetry={retryChart} />
            ) : (
              <MessagesChart data={chart} />
            )}
          </section>

          <section aria-label="Conversaciones recientes" className="mt-8">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
              Conversaciones recientes
            </h3>
            {recentError ? (
              <ErrorState message={recentError} onRetry={retryRecent} />
            ) : (
              <ConversationTable
                conversations={recent}
                statusFilter=""
                loading={recentLoading}
                onSelectConversation={(id) => router.push(`/conversations/${id}`)}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
