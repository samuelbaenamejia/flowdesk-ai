import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "@/components/layout/Header";
import type { GlobalSearchResponse, SearchMessageResult } from "@/types";

const mockLogout = vi.fn();
const mockPush = vi.fn();

vi.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuth = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseGlobalSearch = vi.fn();

vi.mock("@/hooks", () => ({
  useGlobalSearch: () => mockUseGlobalSearch(),
}));

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

const conversation = {
  id: "c1",
  contact_id: "ct1",
  contact_name: "Juan Pérez",
  status: "active" as const,
  last_message_preview: "¿qué día llega?",
  last_message_at: new Date().toISOString(),
  created_at: "",
  updated_at: "",
};

const message: SearchMessageResult = {
  id: "m1",
  conversation_id: "c1",
  contact_name: "Juan Pérez",
  content: "¿qué día llega el pedido?",
  direction: "incoming",
  created_at: new Date().toISOString(),
  highlight: "...¿qué día llega el pedido?",
};

const results: GlobalSearchResponse = {
  conversations: { items: [conversation], total: 1 },
  messages: { items: [message], total: 1 },
};

describe("Header", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { email: "test@flowdesk.ai" },
      logout: mockLogout,
    });
    mockUseGlobalSearch.mockReturnValue(createSearchMock());
  });

  it("renders dashboard label", () => {
    render(<Header />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders user email", () => {
    render(<Header />);
    expect(screen.getByText("test@flowdesk.ai")).toBeInTheDocument();
  });

  it("renders logout button", () => {
    render(<Header />);
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("calls logout and redirects on click", async () => {
    render(<Header />);
    await userEvent.click(screen.getByText("Logout"));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("does not render email when user has no email", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "" },
      logout: mockLogout,
    });
    render(<Header />);
    expect(screen.queryByText("test@flowdesk.ai")).not.toBeInTheDocument();
  });

  it("renders without crashing when user is null", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      logout: mockLogout,
    });
    render(<Header />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders global search input with shortcut hint", () => {
    render(<Header />);
    expect(screen.getByLabelText("Buscar en el inbox")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("calls setQuery when typing", () => {
    const setQuery = vi.fn();
    mockUseGlobalSearch.mockReturnValue(createSearchMock({ setQuery }));
    render(<Header />);
    fireEvent.change(screen.getByLabelText("Buscar en el inbox"), {
      target: { value: "ana" },
    });
    expect(setQuery).toHaveBeenCalledWith("ana");
  });

  it("opens dropdown with grouped results on focus", () => {
    mockUseGlobalSearch.mockReturnValue(createSearchMock({ query: "día", results }));
    render(<Header />);
    fireEvent.focus(screen.getByLabelText("Buscar en el inbox"));
    expect(screen.getByRole("listbox", { name: "Resultados de búsqueda" })).toBeInTheDocument();
    expect(screen.getByText("Conversaciones")).toBeInTheDocument();
    expect(screen.getByText("Mensajes")).toBeInTheDocument();
    expect(screen.getByText("...¿qué día llega el pedido?")).toBeInTheDocument();
  });

  it("navigates to conversation on Enter with selection", () => {
    const clear = vi.fn();
    mockUseGlobalSearch.mockReturnValue(
      createSearchMock({
        query: "día",
        results: {
          conversations: { items: [conversation], total: 1 },
          messages: { items: [], total: 0 },
        },
        clear,
      })
    );
    render(<Header />);
    const input = screen.getByLabelText("Buscar en el inbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/conversations/c1");
    expect(clear).toHaveBeenCalled();
  });

  it("navigates to message with msg param on Enter", () => {
    mockUseGlobalSearch.mockReturnValue(createSearchMock({ query: "día", results }));
    render(<Header />);
    const input = screen.getByLabelText("Buscar en el inbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/conversations/c1?msg=m1");
  });

  it("navigates to search page on Enter without selection", () => {
    mockUseGlobalSearch.mockReturnValue(
      createSearchMock({
        query: "día",
        results: {
          conversations: { items: [], total: 0 },
          messages: { items: [], total: 0 },
        },
      })
    );
    render(<Header />);
    fireEvent.keyDown(screen.getByLabelText("Buscar en el inbox"), { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/search?q=d%C3%ADa");
  });

  it("sets aria-activedescendant on the focused option", () => {
    mockUseGlobalSearch.mockReturnValue(
      createSearchMock({
        query: "día",
        results: {
          conversations: { items: [conversation], total: 1 },
          messages: { items: [], total: 0 },
        },
      })
    );
    render(<Header />);
    const input = screen.getByLabelText("Buscar en el inbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "global-search-option-0");
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("closes dropdown on Escape", () => {
    mockUseGlobalSearch.mockReturnValue(createSearchMock({ query: "día", results }));
    render(<Header />);
    const input = screen.getByLabelText("Buscar en el inbox");
    fireEvent.focus(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clears search and closes dropdown when clicking outside", () => {
    mockUseGlobalSearch.mockReturnValue(createSearchMock({ query: "día", results }));
    render(<Header />);
    fireEvent.focus(screen.getByLabelText("Buscar en el inbox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("focuses the search input on the slash shortcut", () => {
    render(<Header />);
    fireEvent.keyDown(window, { key: "/" });
    expect(screen.getByLabelText("Buscar en el inbox")).toHaveFocus();
  });
});
