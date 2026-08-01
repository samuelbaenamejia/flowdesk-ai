import { useCallback, useEffect, useRef, useState } from "react";
import { getConversations, getDashboardStats, getMessagesOverTime } from "@/lib/api";
import { Conversation, DashboardStats, MessagesOverTimePoint } from "@/types";

const RECENT_LIMIT = 5;

interface UseDashboardReturn {
  stats: DashboardStats | null;
  statsLoading: boolean;
  statsError: string | null;
  chart: MessagesOverTimePoint[];
  chartLoading: boolean;
  chartError: string | null;
  recent: Conversation[];
  recentLoading: boolean;
  recentError: string | null;
  retryStats: () => void;
  retryChart: () => void;
  retryRecent: () => void;
}

export function useDashboard(): UseDashboardReturn {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [chart, setChart] = useState<MessagesOverTimePoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);
  const activeControllersRef = useRef<AbortController[]>([]);

  const trackController = useCallback((controller: AbortController) => {
    activeControllersRef.current.push(controller);
  }, []);

  const abortActive = useCallback(() => {
    activeControllersRef.current.forEach((c) => c.abort());
    activeControllersRef.current = [];
  }, []);

  const fetchStats = useCallback(
    async (signal: AbortSignal) => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const data = await getDashboardStats(signal);
        if (!signal.aborted) setStats(data);
      } catch (err) {
        if (signal.aborted) return;
        setStatsError(err instanceof Error ? err.message : "Error al cargar estadísticas");
      } finally {
        if (!signal.aborted) setStatsLoading(false);
      }
    },
    []
  );

  const fetchChart = useCallback(
    async (signal: AbortSignal) => {
      setChartLoading(true);
      setChartError(null);
      try {
        const data = await getMessagesOverTime(signal);
        if (!signal.aborted) setChart(data.data);
      } catch (err) {
        if (signal.aborted) return;
        setChartError(err instanceof Error ? err.message : "Error al cargar el gráfico");
      } finally {
        if (!signal.aborted) setChartLoading(false);
      }
    },
    []
  );

  const fetchRecent = useCallback(
    async (signal: AbortSignal) => {
      setRecentLoading(true);
      setRecentError(null);
      try {
        const data = await getConversations({ limit: RECENT_LIMIT, offset: 0 }, signal);
        if (!signal.aborted) setRecent(data.items);
      } catch (err) {
        if (signal.aborted) return;
        setRecentError(
          err instanceof Error ? err.message : "Error al cargar conversaciones recientes"
        );
      } finally {
        if (!signal.aborted) setRecentLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    trackController(controller);
    fetchStats(controller.signal);
    fetchChart(controller.signal);
    fetchRecent(controller.signal);

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      abortActive();
      const next = new AbortController();
      trackController(next);
      fetchStats(next.signal);
      fetchChart(next.signal);
      fetchRecent(next.signal);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      abortActive();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [abortActive, fetchChart, fetchRecent, fetchStats, trackController]);

  function retryStats() {
    const controller = new AbortController();
    trackController(controller);
    fetchStats(controller.signal);
  }

  function retryChart() {
    const controller = new AbortController();
    trackController(controller);
    fetchChart(controller.signal);
  }

  function retryRecent() {
    const controller = new AbortController();
    trackController(controller);
    fetchRecent(controller.signal);
  }

  return {
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
  };
}
