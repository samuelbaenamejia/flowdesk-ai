import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/router";
import { vi } from "vitest";
import type { Mock } from "vitest";
import { useConversations } from "@/hooks/useConversations";
import ConversationsPage from "@/pages/conversations";

vi.mock("@/hooks/useConversations", () => ({
  useConversations: vi.fn(),
}));

vi.mock("next/router", () => ({
  useRouter: vi.fn(),
}));

const mockUseConversations = vi.mocked(useConversations);
const mockPush = vi.fn();

function createMockReturn(overrides: Record<string, unknown> = {}) {
  return {
    conversations: [],
    total: 0,
    loading: false,
    error: null,
    statusFilter: "",
    search: "",
    dateFrom: null,
    dateTo: null,
    offset: 0,
    hasMore: false,
    setStatusFilter: vi.fn(),
    setSearch: vi.fn(),
    setDateFrom: vi.fn(),
    setDateTo: vi.fn(),
    handlePrevious: vi.fn(),
    handleNext: vi.fn(),
    retry: vi.fn(),
    filters: { q: "", status: "", date_from: null, date_to: null },
    ...overrides,
  };
}

describe("ConversationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as Mock).mockReturnValue({ push: mockPush });
  });

  it("renders loading state with skeletons", () => {
    mockUseConversations.mockReturnValue(createMockReturn({ loading: true }));
    render(<ConversationsPage />);
    expect(screen.getByText("Conversaciones")).toBeInTheDocument();
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(5);
  });

  it("renders conversations when data is loaded", () => {
    mockUseConversations.mockReturnValue(
      createMockReturn({
        conversations: [
          {
            id: "1",
            contact_id: "c1",
            contact_name: "Juan Pérez",
            status: "active",
            last_message_preview: "Hola",
            last_message_at: new Date().toISOString(),
            created_at: "",
            updated_at: "",
          },
        ],
        hasMore: false,
      })
    );
    render(<ConversationsPage />);
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
  });

  it("renders empty state when no conversations", () => {
    mockUseConversations.mockReturnValue(createMockReturn());
    render(<ConversationsPage />);
    expect(screen.getByRole("heading", { name: "No hay conversaciones" })).toBeInTheDocument();
  });

  it("renders error state and retry works", async () => {
    const retry = vi.fn();
    mockUseConversations.mockReturnValue(
      createMockReturn({ error: "Error de red", retry })
    );
    render(<ConversationsPage />);
    expect(screen.getByText("Error de red")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Reintentar"));
    expect(retry).toHaveBeenCalled();
  });

  it("calls router.push on row click", async () => {
    mockUseConversations.mockReturnValue(
      createMockReturn({
        conversations: [
          {
            id: "42",
            contact_id: "c1",
            contact_name: "Ana",
            status: "active",
            last_message_preview: "Test",
            last_message_at: new Date().toISOString(),
            created_at: "",
            updated_at: "",
          },
        ],
      })
    );
    render(<ConversationsPage />);
    await userEvent.click(screen.getByText("Ana"));
    expect(mockPush).toHaveBeenCalledWith("/conversations/42");
  });

  it("shows pagination when conversations exist", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      contact_id: `c${i}`,
      contact_name: `User ${i + 1}`,
      status: "active" as const,
      last_message_preview: "msg",
      last_message_at: new Date().toISOString(),
      created_at: "",
      updated_at: "",
    }));
    mockUseConversations.mockReturnValue(
      createMockReturn({ conversations: items, hasMore: true })
    );
    render(<ConversationsPage />);
    expect(screen.getByText("1 – 20")).toBeInTheDocument();
    expect(screen.getByText("Siguiente")).toBeInTheDocument();
  });

  it("hides pagination when no conversations", () => {
    mockUseConversations.mockReturnValue(createMockReturn());
    render(<ConversationsPage />);
    expect(screen.queryByText("Siguiente")).not.toBeInTheDocument();
  });

  it("clears error and shows loading when filter changes after error", () => {
    mockUseConversations.mockReturnValue(
      createMockReturn({ error: "Error de red", loading: false })
    );
    const { rerender } = render(<ConversationsPage />);
    expect(screen.getByText("Error de red")).toBeInTheDocument();

    mockUseConversations.mockReturnValue(
      createMockReturn({ loading: true, error: null })
    );
    rerender(<ConversationsPage />);
    expect(screen.queryByText("Error de red")).not.toBeInTheDocument();
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(5);
  });

  it("calls setSearch when typing in the search input", () => {
    const setSearch = vi.fn();
    mockUseConversations.mockReturnValue(createMockReturn({ setSearch }));
    render(<ConversationsPage />);
    fireEvent.change(screen.getByLabelText("Buscar conversaciones por contacto"), {
      target: { value: "ana" },
    });
    expect(setSearch).toHaveBeenCalledWith("ana");
  });

  it("clears all filters when clicking Limpiar filtros", async () => {
    const setSearch = vi.fn();
    const setStatusFilter = vi.fn();
    const setDateFrom = vi.fn();
    const setDateTo = vi.fn();
    mockUseConversations.mockReturnValue(
      createMockReturn({
        search: "ana",
        statusFilter: "active",
        dateFrom: "2026-01-01",
        dateTo: "2026-06-30",
        setSearch,
        setStatusFilter,
        setDateFrom,
        setDateTo,
      })
    );
    render(<ConversationsPage />);
    expect(screen.getByText("4 activos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(setSearch).toHaveBeenCalledWith("");
    expect(setStatusFilter).toHaveBeenCalledWith("");
    expect(setDateFrom).toHaveBeenCalledWith(null);
    expect(setDateTo).toHaveBeenCalledWith(null);
  });

  it("shows range with total in pagination", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      contact_id: `c${i}`,
      contact_name: `User ${i + 1}`,
      status: "active" as const,
      last_message_preview: "msg",
      last_message_at: new Date().toISOString(),
      created_at: "",
      updated_at: "",
    }));
    mockUseConversations.mockReturnValue(
      createMockReturn({ conversations: items, total: 42, hasMore: true })
    );
    render(<ConversationsPage />);
    expect(screen.getByText("1 – 20 de 42")).toBeInTheDocument();
  });

  it("shows search empty state when there are no results", () => {
    mockUseConversations.mockReturnValue(
      createMockReturn({ search: "ana" })
    );
    render(<ConversationsPage />);
    expect(screen.getByText('Sin resultados para "ana"')).toBeInTheDocument();
  });
});
