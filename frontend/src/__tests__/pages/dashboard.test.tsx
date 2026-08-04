import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/router";
import { vi } from "vitest";
import type { Mock } from "vitest";
import { useDashboard } from "@/hooks";
import DashboardPage from "@/pages/dashboard/index";
import type { Conversation, DashboardStats, MessagesOverTimePoint } from "@/types";

vi.mock("@/hooks", () => ({
  useDashboard: vi.fn(),
}));

vi.mock("next/router", () => ({
  useRouter: vi.fn(),
}));

const mockUseDashboard = vi.mocked(useDashboard);

const stats: DashboardStats = {
  total_conversations: 1234,
  messages_today: 56,
  messages_this_week: 300,
  response_rate: 80.4,
  avg_response_time_minutes: 3.25,
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

function createDashboardMock(overrides: Record<string, unknown> = {}) {
  return {
    stats,
    statsLoading: false,
    statsError: null,
    chart,
    chartLoading: false,
    chartError: null,
    recent,
    recentLoading: false,
    recentError: null,
    retryStats: vi.fn(),
    retryChart: vi.fn(),
    retryRecent: vi.fn(),
    ...overrides,
  };
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as Mock).mockReturnValue({ push: vi.fn() });
    mockUseDashboard.mockReturnValue(createDashboardMock());
  });

  it("renders the four stat cards with formatted values", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Conversaciones totales")).toBeInTheDocument();
    expect(screen.getByText("1.234")).toBeInTheDocument();
    expect(screen.getByText("Mensajes hoy")).toBeInTheDocument();
    expect(screen.getByText("56")).toBeInTheDocument();
    expect(screen.getByText("Tasa de respuesta")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("Tiempo medio de respuesta")).toBeInTheDocument();
    expect(screen.getByText("3,3 min")).toBeInTheDocument();
  });

  it("renders the chart and recent conversations sections", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Mensajes por día")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText("Conversaciones recientes")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
  });

  it("navigates to a conversation when a recent row is clicked", async () => {
    const push = vi.fn();
    (useRouter as Mock).mockReturnValue({ push });
    render(<DashboardPage />);
    await userEvent.click(screen.getByText("Juan Pérez"));
    expect(push).toHaveBeenCalledWith("/conversations/c1");
  });

  it("renders stat skeletons while stats are loading", () => {
    mockUseDashboard.mockReturnValue(
      createDashboardMock({ stats: null, statsLoading: true })
    );
    const { container } = render(<DashboardPage />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText("Conversaciones totales")).not.toBeInTheDocument();
  });

  it("renders an error state with retry when stats fail", async () => {
    const retryStats = vi.fn();
    mockUseDashboard.mockReturnValue(
      createDashboardMock({ stats: null, statsLoading: false, statsError: "stats fail", retryStats })
    );
    render(<DashboardPage />);
    expect(screen.getByText("stats fail")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Reintentar"));
    expect(retryStats).toHaveBeenCalledTimes(1);
  });

  it("renders an error state with retry when the chart fails", async () => {
    const retryChart = vi.fn();
    mockUseDashboard.mockReturnValue(
      createDashboardMock({ chart: [], chartLoading: false, chartError: "chart fail", retryChart })
    );
    render(<DashboardPage />);
    expect(screen.getByText("chart fail")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Reintentar"));
    expect(retryChart).toHaveBeenCalledTimes(1);
  });

  it("renders an error state with retry when recent conversations fail", async () => {
    const retryRecent = vi.fn();
    mockUseDashboard.mockReturnValue(
      createDashboardMock({ recent: [], recentLoading: false, recentError: "recent fail", retryRecent })
    );
    render(<DashboardPage />);
    expect(screen.getByText("recent fail")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Reintentar"));
    expect(retryRecent).toHaveBeenCalledTimes(1);
  });

  it("renders the empty state with a CTA when there are no conversations", async () => {
    const push = vi.fn();
    (useRouter as Mock).mockReturnValue({ push });
    mockUseDashboard.mockReturnValue(
      createDashboardMock({ stats: { ...stats, total_conversations: 0 } })
    );
    render(<DashboardPage />);
    expect(screen.getByText("Empieza a conversar")).toBeInTheDocument();
    expect(screen.queryByText("Conversaciones totales")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Crear contacto"));
    expect(push).toHaveBeenCalledWith("/contacts");
  });
});
