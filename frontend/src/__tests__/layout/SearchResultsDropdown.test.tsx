import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchResultsDropdown } from "@/components/layout/SearchResultsDropdown";
import type { GlobalSearchResponse, SearchMessageResult } from "@/types";

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

const BASE_PROPS = {
  query: "día",
  results,
  loading: false,
  activeIndex: -1,
  onSelectConversation: vi.fn(),
  onSelectMessage: vi.fn(),
  onViewAll: vi.fn(),
};

describe("SearchResultsDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders conversation group with name, badge and count", () => {
    render(<SearchResultsDropdown {...BASE_PROPS} />);
    expect(screen.getByText("Conversaciones")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("renders message group with highlight fragment", () => {
    render(<SearchResultsDropdown {...BASE_PROPS} />);
    expect(screen.getByText("Mensajes")).toBeInTheDocument();
    expect(screen.getByText("...¿qué día llega el pedido?")).toBeInTheDocument();
  });

  it("shows view all when totals exceed shown items", () => {
    render(
      <SearchResultsDropdown
        {...BASE_PROPS}
        results={{
          conversations: { items: [conversation], total: 5 },
          messages: { items: [message], total: 1 },
        }}
      />
    );
    expect(screen.getByText("Ver todos los resultados")).toBeInTheDocument();
  });

  it("hides view all when totals match shown items", () => {
    render(<SearchResultsDropdown {...BASE_PROPS} />);
    expect(screen.queryByText("Ver todos los resultados")).not.toBeInTheDocument();
  });

  it("renders loading skeletons when loading without results", () => {
    const { container } = render(
      <SearchResultsDropdown {...BASE_PROPS} loading results={null} />
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(3);
  });

  it("renders empty state when there are no results", () => {
    render(
      <SearchResultsDropdown
        {...BASE_PROPS}
        results={{ conversations: { items: [], total: 0 }, messages: { items: [], total: 0 } }}
      />
    );
    expect(screen.getByText('Sin resultados para "día"')).toBeInTheDocument();
  });

  it("marks the active option as selected", () => {
    render(<SearchResultsDropdown {...BASE_PROPS} activeIndex={0} />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
    expect(options[0]).toHaveAttribute("id", "global-search-option-0");
    expect(options[1]).toHaveAttribute("id", "global-search-option-1");
  });

  it("calls onSelectConversation when clicking a conversation", async () => {
    render(<SearchResultsDropdown {...BASE_PROPS} />);
    await userEvent.click(screen.getByText("Juan Pérez"));
    expect(BASE_PROPS.onSelectConversation).toHaveBeenCalledWith("c1");
  });

  it("calls onSelectMessage when clicking a message", async () => {
    render(<SearchResultsDropdown {...BASE_PROPS} />);
    await userEvent.click(screen.getByText("...¿qué día llega el pedido?"));
    expect(BASE_PROPS.onSelectMessage).toHaveBeenCalledWith(message);
  });

  it("calls onViewAll when clicking view all", async () => {
    render(
      <SearchResultsDropdown
        {...BASE_PROPS}
        results={{
          conversations: { items: [conversation], total: 5 },
          messages: { items: [message], total: 5 },
        }}
      />
    );
    await userEvent.click(screen.getByText("Ver todos los resultados"));
    expect(BASE_PROPS.onViewAll).toHaveBeenCalledTimes(1);
  });

  it("calls onMouseEnterOption when hovering an option", async () => {
    const onMouseEnterOption = vi.fn();
    render(<SearchResultsDropdown {...BASE_PROPS} onMouseEnterOption={onMouseEnterOption} />);
    await userEvent.hover(screen.getByText("Juan Pérez"));
    expect(onMouseEnterOption).toHaveBeenCalledWith(0);
  });
});
