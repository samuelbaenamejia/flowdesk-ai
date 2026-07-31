import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/router";
import { useGlobalSearch } from "@/hooks";
import SearchPage from "@/pages/search/index";
import type { GlobalSearchResponse, SearchMessageResult } from "@/types";

vi.mock("@/hooks", () => ({
  useGlobalSearch: vi.fn(),
}));

vi.mock("next/router", () => ({
  useRouter: vi.fn(),
}));

const mockUseGlobalSearch = vi.mocked(useGlobalSearch);

const conversation = {
  id: "c1",
  contact_id: "ct1",
  contact_name: "Juan Pérez",
  status: "active" as const,
  last_message_preview: "¿qué día llega?",
  last_message_at: new Date().toISOString(),
  created_at: "2026-07-01T10:00:00Z",
  updated_at: "2026-07-01T10:00:00Z",
};

const message: SearchMessageResult = {
  id: "m1",
  conversation_id: "c1",
  contact_name: "María Gómez",
  content: "¿qué día llega el pedido?",
  direction: "incoming",
  created_at: new Date().toISOString(),
  highlight: "...¿qué día llega el pedido?",
};

const results: GlobalSearchResponse = {
  conversations: { items: [conversation], total: 1 },
  messages: { items: [message], total: 1 },
};

function createSearchMock(overrides: Record<string, unknown> = {}) {
  return {
    results: null,
    loading: false,
    error: null,
    query: "",
    setQuery: vi.fn(),
    clear: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
}

describe("SearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as vi.Mock).mockReturnValue({ query: { q: "día" }, push: vi.fn() });
    mockUseGlobalSearch.mockReturnValue(
      createSearchMock({ query: "día", results })
    );
  });

  it("renders the page title and search input with the url query", () => {
    render(<SearchPage />);
    expect(screen.getByText("Búsqueda global")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar conversaciones y mensajes")).toHaveValue("día");
  });

  it("renders grouped results with badges", () => {
    render(<SearchPage />);
    expect(screen.getByText("Conversaciones")).toBeInTheDocument();
    expect(screen.getByText("Mensajes")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText("...¿qué día llega el pedido?")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("navigates to a conversation when a conversation result is clicked", async () => {
    const push = vi.fn();
    (useRouter as vi.Mock).mockReturnValue({ query: { q: "día" }, push });
    render(<SearchPage />);
    await userEvent.click(screen.getByText("Juan Pérez"));
    expect(push).toHaveBeenCalledWith("/conversations/c1");
  });

  it("navigates to the message deep link when a message result is clicked", async () => {
    const push = vi.fn();
    (useRouter as vi.Mock).mockReturnValue({ query: { q: "día" }, push });
    render(<SearchPage />);
    await userEvent.click(screen.getByText("...¿qué día llega el pedido?"));
    expect(push).toHaveBeenCalledWith("/conversations/c1?msg=m1");
  });

  it("submits the form and navigates when the query changes", async () => {
    const push = vi.fn();
    (useRouter as vi.Mock).mockReturnValue({ query: { q: "día" }, push });
    render(<SearchPage />);
    fireEvent.change(screen.getByLabelText("Buscar conversaciones y mensajes"), {
      target: { value: "pedido" },
    });
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/search?q=pedido");
  });

  it("renders the empty state when there are no results", () => {
    mockUseGlobalSearch.mockReturnValue(
      createSearchMock({
        query: "día",
        results: { conversations: { items: [], total: 0 }, messages: { items: [], total: 0 } },
      })
    );
    render(<SearchPage />);
    expect(screen.getByText('Sin resultados para "día"')).toBeInTheDocument();
  });

  it("renders the error state and retries", async () => {
    const retry = vi.fn();
    mockUseGlobalSearch.mockReturnValue(
      createSearchMock({ query: "día", error: "No se pudo conectar con el servidor", retry })
    );
    render(<SearchPage />);
    expect(screen.getByText("No se pudo conectar con el servidor")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Reintentar"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("renders skeletons while loading without results", () => {
    mockUseGlobalSearch.mockReturnValue(createSearchMock({ query: "día", loading: true }));
    const { container } = render(<SearchPage />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
