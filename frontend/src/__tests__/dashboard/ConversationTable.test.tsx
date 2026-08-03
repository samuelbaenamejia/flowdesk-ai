import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationTable } from "@/components/dashboard/ConversationTable";
import type { Conversation } from "@/types";

const FIXED_NOW = new Date("2025-01-15T12:00:00Z");

const mockConversations: Conversation[] = [
  {
    id: "1",
    contact_id: "c1",
    contact_name: "Juan Pérez",
    status: "active",
    last_message_preview: "Hola, necesito información",
    last_message_at: new Date(FIXED_NOW.getTime() - 120000).toISOString(),
    created_at: "",
    updated_at: "",
  },
  {
    id: "2",
    contact_id: "c2",
    contact_name: "María García",
    status: "human_takeover",
    last_message_preview: "Ya le dije que no",
    last_message_at: new Date(FIXED_NOW.getTime() - 3600000).toISOString(),
    created_at: "",
    updated_at: "",
  },
  {
    id: "3",
    contact_id: "c3",
    contact_name: "Carlos López",
    status: "closed",
    last_message_preview: "Gracias, quedó solucionado",
    last_message_at: new Date(FIXED_NOW.getTime() - 172800000).toISOString(),
    created_at: "",
    updated_at: "",
  },
];

describe("ConversationTable", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterAll(() => {
    vi.useRealTimers();
  });
  it("renders rows with contact name, badge, preview and time", () => {
    render(
      <ConversationTable
        conversations={mockConversations}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("María García")).toBeInTheDocument();
    expect(screen.getByText("Carlos López")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText("Takeover")).toBeInTheDocument();
    expect(screen.getByText("Cerrada")).toBeInTheDocument();
  });

  it("renders skeletons when loading", () => {
    const { container } = render(
      <ConversationTable
        conversations={[]}
        statusFilter=""
        loading={true}
        onSelectConversation={() => {}}
      />
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(5);
  });

  it("renders empty state without filter", () => {
    render(
      <ConversationTable
        conversations={[]}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText("No hay conversaciones")).toBeInTheDocument();
  });

  it("renders contextual empty state for active filter", () => {
    render(
      <ConversationTable
        conversations={[]}
        statusFilter="active"
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText("No hay conversaciones activas")).toBeInTheDocument();
  });

  it("renders contextual empty state for human_takeover filter", () => {
    render(
      <ConversationTable
        conversations={[]}
        statusFilter="human_takeover"
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText("No hay conversaciones en takeover")).toBeInTheDocument();
  });

  it("renders contextual empty state for closed filter", () => {
    render(
      <ConversationTable
        conversations={[]}
        statusFilter="closed"
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText("No hay conversaciones cerradas")).toBeInTheDocument();
  });

  it("renders empty state with search query", () => {
    render(
      <ConversationTable
        conversations={[]}
        statusFilter=""
        loading={false}
        searchQuery="ana"
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText('Sin resultados para "ana"')).toBeInTheDocument();
  });

  it("renders empty state for date range filter", () => {
    render(
      <ConversationTable
        conversations={[]}
        statusFilter=""
        loading={false}
        dateRangeActive
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText("No hay conversaciones en el rango de fechas")).toBeInTheDocument();
  });

  it("prioritizes search query empty state over status", () => {
    render(
      <ConversationTable
        conversations={[]}
        statusFilter="active"
        loading={false}
        searchQuery="ana"
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText('Sin resultados para "ana"')).toBeInTheDocument();
    expect(screen.queryByText("No hay conversaciones activas")).not.toBeInTheDocument();
  });

  it("maps active status to success badge", () => {
    render(
      <ConversationTable
        conversations={[mockConversations[0]]}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    const badge = screen.getByText("Activa");
    expect(badge.className).toContain("bg-green-50");
  });

  it("maps human_takeover status to warning badge", () => {
    render(
      <ConversationTable
        conversations={[mockConversations[1]]}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    const badge = screen.getByText("Takeover");
    expect(badge.className).toContain("bg-yellow-50");
  });

  it("maps closed status to default badge", () => {
    render(
      <ConversationTable
        conversations={[mockConversations[2]]}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    const badge = screen.getByText("Cerrada");
    expect(badge.className).toContain("bg-gray-100");
  });

  it("uses default badge for unknown status", () => {
    const unknown = { ...mockConversations[0], status: "pending" as const };
    render(
      <ConversationTable
        conversations={[unknown]}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    const badge = screen.getByText("Cerrada");
    expect(badge.className).toContain("bg-gray-100");
  });

  it("calls onSelectConversation with conversation id on row click", async () => {
    const onSelect = vi.fn();
    render(
      <ConversationTable
        conversations={mockConversations}
        statusFilter=""
        loading={false}
        onSelectConversation={onSelect}
      />
    );
    await userEvent.click(screen.getByText("Juan Pérez"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("shows relative time", () => {
    render(
      <ConversationTable
        conversations={[mockConversations[0]]}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText("hace 2 minutos")).toBeInTheDocument();
  });

  it("shows empty cell when last_message_at is null", () => {
    const noDate = { ...mockConversations[0], last_message_at: null };
    render(
      <ConversationTable
        conversations={[noDate]}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    const cells = screen.getAllByRole("cell");
    const lastCell = cells[cells.length - 1];
    expect(lastCell.textContent).toBe("");
  });

  it("shows unread badge and dot when unread_count is greater than zero", () => {
    const withUnread = { ...mockConversations[0], unread_count: 3 };
    const { container } = render(
      <ConversationTable
        conversations={[withUnread]}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(
      container.querySelector('[aria-label="3 mensajes no leídos"]')
    ).not.toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("caps the unread badge at 99+", () => {
    const withUnread = { ...mockConversations[0], unread_count: 150 };
    render(
      <ConversationTable
        conversations={[withUnread]}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("does not render unread badge when unread_count is zero or missing", () => {
    const { container } = render(
      <ConversationTable
        conversations={mockConversations}
        statusFilter=""
        loading={false}
        onSelectConversation={() => {}}
      />
    );
    expect(
      container.querySelector('[aria-label*="mensajes no leídos"]')
    ).toBeNull();
  });
});
