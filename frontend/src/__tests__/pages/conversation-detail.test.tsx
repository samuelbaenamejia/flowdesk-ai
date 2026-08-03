import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/router";
import { useConversation, useMessages } from "@/hooks";
import { markConversationRead } from "@/lib/api";
import ConversationDetailPage from "@/pages/conversations/[id]";

vi.mock("@/lib/api", () => ({
  markConversationRead: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/hooks")>("@/hooks");
  return {
    ...actual,
    useConversation: vi.fn(),
    useMessages: vi.fn(),
  };
});

vi.mock("next/router", () => ({
  useRouter: vi.fn(),
}));

const mockUseConversation = vi.mocked(useConversation);
const mockUseMessages = vi.mocked(useMessages);

const conversation = {
  id: "1",
  contact_id: "c1",
  contact_name: "Juan Pérez",
  status: "active" as const,
  last_message_preview: "Hola",
  last_message_at: new Date().toISOString(),
  created_at: "2026-07-01T10:00:00Z",
  updated_at: "2026-07-01T10:00:00Z",
};

function createConversationMock(overrides: Record<string, unknown> = {}) {
  return {
    conversation,
    loading: false,
    error: null,
    notFound: false,
    toggleStatus: vi.fn(),
    toggling: false,
    toggleError: null,
    ...overrides,
  };
}

function createMessagesMock(overrides: Record<string, unknown> = {}) {
  return {
    messages: [],
    total: 0,
    loading: false,
    error: null,
    search: "",
    directionFilter: "",
    statusFilter: "",
    dateFrom: null,
    dateTo: null,
    hasMore: false,
    setSearch: vi.fn(),
    setDirectionFilter: vi.fn(),
    setStatusFilter: vi.fn(),
    setDateFrom: vi.fn(),
    setDateTo: vi.fn(),
    loadMore: vi.fn(),
    sendMessage: vi.fn(),
    sending: false,
    sendError: null,
    ...overrides,
  };
}

describe("ConversationDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as vi.Mock).mockReturnValue({ query: { id: "1" }, push: vi.fn() });
  });

  it("renders header, message filters and empty message list", () => {
    mockUseConversation.mockReturnValue(createConversationMock());
    mockUseMessages.mockReturnValue(createMessagesMock());
    render(<ConversationDetailPage />);
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar en mensajes")).toBeInTheDocument();
    expect(screen.getByText("No hay mensajes")).toBeInTheDocument();
  });

  it("calls setSearch when typing in the message search input", () => {
    const setSearch = vi.fn();
    mockUseConversation.mockReturnValue(createConversationMock());
    mockUseMessages.mockReturnValue(createMessagesMock({ setSearch }));
    render(<ConversationDetailPage />);
    fireEvent.change(screen.getByLabelText("Buscar en mensajes"), {
      target: { value: "pedido" },
    });
    expect(setSearch).toHaveBeenCalledWith("pedido");
  });

  it("clears all filters when clicking Limpiar filtros", async () => {
    const setSearch = vi.fn();
    const setDirectionFilter = vi.fn();
    const setStatusFilter = vi.fn();
    const setDateFrom = vi.fn();
    const setDateTo = vi.fn();
    mockUseConversation.mockReturnValue(createConversationMock());
    mockUseMessages.mockReturnValue(
      createMessagesMock({
        search: "pedido",
        directionFilter: "outgoing",
        statusFilter: "failed",
        dateFrom: "2026-01-01",
        dateTo: "2026-06-30",
        setSearch,
        setDirectionFilter,
        setStatusFilter,
        setDateFrom,
        setDateTo,
      })
    );
    render(<ConversationDetailPage />);
    expect(screen.getByText("5 activos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(setSearch).toHaveBeenCalledWith("");
    expect(setDirectionFilter).toHaveBeenCalledWith("");
    expect(setStatusFilter).toHaveBeenCalledWith("");
    expect(setDateFrom).toHaveBeenCalledWith(null);
    expect(setDateTo).toHaveBeenCalledWith(null);
  });

  it("shows contextual empty state when search has no results", () => {
    mockUseConversation.mockReturnValue(createConversationMock());
    mockUseMessages.mockReturnValue(createMessagesMock({ search: "pedido" }));
    render(<ConversationDetailPage />);
    expect(screen.getByText('Sin resultados para "pedido"')).toBeInTheDocument();
  });

  it("scrolls to and highlights the message targeted by the msg query param", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    mockUseConversation.mockReturnValue(createConversationMock());
    mockUseMessages.mockReturnValue(
      createMessagesMock({
        messages: [
          {
            id: "m1",
            conversation_id: "1",
            direction: "incoming" as const,
            content_type: "text",
            content: "Hola",
            wa_message_id: null,
            status: "delivered" as const,
            created_at: "2026-07-01T10:00:00Z",
          },
          {
            id: "m5",
            conversation_id: "1",
            direction: "outgoing" as const,
            content_type: "text",
            content: "Pedido en camino",
            wa_message_id: null,
            status: "read" as const,
            created_at: "2026-07-01T10:01:00Z",
          },
        ],
      })
    );
    (useRouter as vi.Mock).mockReturnValue({ query: { id: "1", msg: "m5" }, push: vi.fn() });
    render(<ConversationDetailPage />);
    expect(scrollIntoView).toHaveBeenCalled();
    const target = document.querySelector('[data-message-id="m5"]');
    expect(target).not.toBeNull();
    expect(target!.querySelector("div")!.className).toContain("ring-amber-300");
  });

  it("opens and focuses the message search on Ctrl+F", async () => {
    mockUseConversation.mockReturnValue(createConversationMock());
    mockUseMessages.mockReturnValue(
      createMessagesMock({
        messages: [
          {
            id: "m1",
            conversation_id: "1",
            direction: "incoming" as const,
            content_type: "text",
            content: "Hola",
            wa_message_id: null,
            status: "delivered" as const,
            created_at: "2026-07-01T10:00:00Z",
          },
        ],
        total: 1,
      })
    );
    render(<ConversationDetailPage />);

    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(screen.getByLabelText("Buscar en mensajes")).toHaveFocus();
  });

  it("clears the search filters on Escape while search is active", async () => {
    const setSearch = vi.fn();
    const setDirectionFilter = vi.fn();
    mockUseConversation.mockReturnValue(createConversationMock());
    mockUseMessages.mockReturnValue(
      createMessagesMock({
        search: "pedido",
        total: 3,
        messages: [
          {
            id: "m1",
            conversation_id: "1",
            direction: "incoming" as const,
            content_type: "text",
            content: "Hola",
            wa_message_id: null,
            status: "delivered" as const,
            created_at: "2026-07-01T10:00:00Z",
          },
        ],
        setSearch,
        setDirectionFilter,
      })
    );
    render(<ConversationDetailPage />);

    fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => {});
    expect(setSearch).toHaveBeenCalledWith("");
    expect(setDirectionFilter).toHaveBeenCalledWith("");
  });

  it("marks the conversation as read on mount", () => {
    mockUseConversation.mockReturnValue(createConversationMock());
    mockUseMessages.mockReturnValue(createMessagesMock());
    render(<ConversationDetailPage />);

    expect(markConversationRead).toHaveBeenCalledTimes(1);
    expect(markConversationRead).toHaveBeenCalledWith("1");
  });

  it("shows the floating button with badge when scrolled away and hides it in search mode", async () => {
    const msg = {
      id: "m1",
      conversation_id: "1",
      direction: "incoming" as const,
      content_type: "text",
      content: "Hola",
      wa_message_id: null,
      status: "delivered" as const,
      created_at: "2026-07-01T10:00:00Z",
    };
    mockUseConversation.mockReturnValue(createConversationMock());
    mockUseMessages.mockReturnValue(createMessagesMock({ messages: [msg], total: 1 }));
    const { rerender } = render(<ConversationDetailPage />);

    expect(
      screen.queryByRole("button", { name: "Ir al final y ver mensajes nuevos" })
    ).not.toBeInTheDocument();

    const container = document.querySelector('[role="log"]') as HTMLElement;
    Object.defineProperty(container, "scrollTop", { value: 0, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 600, configurable: true });
    Object.defineProperty(container, "scrollHeight", { value: 2000, configurable: true });
    fireEvent.scroll(container);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    const fab = screen.getByRole("button", {
      name: "Ir al final y ver mensajes nuevos",
    });
    expect(fab).toBeInTheDocument();
    expect(fab).not.toHaveTextContent("1");

    mockUseMessages.mockReturnValue(
      createMessagesMock({ messages: [msg, { ...msg, id: "m2" }], total: 2 })
    );
    rerender(<ConversationDetailPage />);
    expect(
      screen.getByRole("button", { name: "Ir al final y ver mensajes nuevos" })
    ).toHaveTextContent("1");

    mockUseMessages.mockReturnValue(
      createMessagesMock({ messages: [msg, { ...msg, id: "m2" }], total: 2, search: "hola" })
    );
    rerender(<ConversationDetailPage />);
    expect(
      screen.queryByRole("button", { name: "Ir al final y ver mensajes nuevos" })
    ).not.toBeInTheDocument();
  });
});
