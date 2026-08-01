import { renderHook, waitFor, act } from "@testing-library/react";
import { useDashboard } from "@/hooks/useDashboard";
import { getConversations, getDashboardStats, getMessagesOverTime } from "@/lib/api";
import type { Conversation, DashboardStats, MessagesOverTimePoint } from "@/types";

vi.mock("@/lib/api", () => ({
  getConversations: vi.fn(),
  getDashboardStats: vi.fn(),
  getMessagesOverTime: vi.fn(),
}));

const getDashboardStatsMock = vi.mocked(getDashboardStats);
const getMessagesOverTimeMock = vi.mocked(getMessagesOverTime);
const getConversationsMock = vi.mocked(getConversations);

const stats: DashboardStats = {
  total_conversations: 42,
  messages_today: 7,
  messages_this_week: 30,
  response_rate: 80,
  avg_response_time_minutes: 3.2,
  top_contacts: [],
};

const chart: MessagesOverTimePoint[] = [
  { date: "2026-07-01", count: 2 },
  { date: "2026-07-02", count: 5 },
];

const recent: Conversation[] = [
  {
    id: "c1",
    contact_id: "ct1",
    contact_name: "Juan Pérez",
    status: "active",
    last_message_preview: "Hola",
    last_message_at: new Date().toISOString(),
    created_at: "",
    updated_at: "",
  },
];

describe("useDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches stats, chart and recent conversations on mount", async () => {
    getDashboardStatsMock.mockResolvedValue(stats);
    getMessagesOverTimeMock.mockResolvedValue({ data: chart });
    getConversationsMock.mockResolvedValue({ items: recent, total: 1, limit: 5, offset: 0 });

    const { result } = renderHook(() => useDashboard());

    expect(getDashboardStatsMock).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(getMessagesOverTimeMock).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(getConversationsMock).toHaveBeenCalledWith(
      { limit: 5, offset: 0 },
      expect.any(AbortSignal)
    );

    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    expect(result.current.stats).toEqual(stats);
    expect(result.current.chart).toEqual(chart);
    expect(result.current.recent).toEqual(recent);
    expect(result.current.statsError).toBeNull();
    expect(result.current.chartError).toBeNull();
    expect(result.current.recentError).toBeNull();
  });

  it("reports errors independently per section", async () => {
    getDashboardStatsMock.mockRejectedValue(new Error("stats fail"));
    getMessagesOverTimeMock.mockResolvedValue({ data: chart });
    getConversationsMock.mockResolvedValue({ items: recent, total: 1, limit: 5, offset: 0 });

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    expect(result.current.statsError).toBe("stats fail");
    expect(result.current.stats).toBeNull();
    expect(result.current.chartError).toBeNull();
    expect(result.current.chart).toEqual(chart);
    expect(result.current.recentError).toBeNull();
  });

  it("retryStats refetches only the stats section", async () => {
    getDashboardStatsMock.mockRejectedValueOnce(new Error("stats fail")).mockResolvedValueOnce(stats);
    getMessagesOverTimeMock.mockResolvedValue({ data: chart });
    getConversationsMock.mockResolvedValue({ items: recent, total: 1, limit: 5, offset: 0 });

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.statsError).toBe("stats fail"));
    const callsBefore = getConversationsMock.mock.calls.length;

    act(() => {
      result.current.retryStats();
    });

    await waitFor(() => expect(result.current.stats).toEqual(stats));
    expect(getDashboardStatsMock).toHaveBeenCalledTimes(2);
    expect(getConversationsMock.mock.calls.length).toBe(callsBefore);
    expect(getMessagesOverTimeMock).toHaveBeenCalledTimes(1);
  });

  it("keeps previous data when a retry fails", async () => {
    getDashboardStatsMock.mockResolvedValueOnce(stats).mockRejectedValueOnce(new Error("fail again"));
    getMessagesOverTimeMock.mockResolvedValue({ data: chart });
    getConversationsMock.mockResolvedValue({ items: recent, total: 1, limit: 5, offset: 0 });

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.stats).toEqual(stats));

    act(() => {
      result.current.retryStats();
    });

    await waitFor(() => expect(result.current.statsError).toBe("fail again"));
    expect(result.current.stats).toEqual(stats);
  });
});
