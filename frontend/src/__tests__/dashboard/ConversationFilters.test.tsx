import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationFilters } from "@/components/dashboard/ConversationFilters";

const BASE_PROPS = {
  search: "",
  statusFilter: "",
  dateFrom: null,
  dateTo: null,
  onSearchChange: vi.fn(),
  onStatusChange: vi.fn(),
  onDateFromChange: vi.fn(),
  onDateToChange: vi.fn(),
  onClear: vi.fn(),
};

describe("ConversationFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search, status, dates and clear button", () => {
    render(<ConversationFilters {...BASE_PROPS} />);
    expect(screen.getByLabelText("Buscar conversaciones por contacto")).toBeInTheDocument();
    expect(screen.getByLabelText("Estado:")).toBeInTheDocument();
    expect(screen.getByLabelText("Desde:")).toBeInTheDocument();
    expect(screen.getByLabelText("Hasta:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument();
  });

  it("renders all four status options", () => {
    render(<ConversationFilters {...BASE_PROPS} />);
    expect(screen.getByText("Todas")).toBeInTheDocument();
    expect(screen.getByText("Activas")).toBeInTheDocument();
    expect(screen.getByText("Human Takeover")).toBeInTheDocument();
    expect(screen.getByText("Cerradas")).toBeInTheDocument();
  });

  it("calls onSearchChange when typing", () => {
    render(<ConversationFilters {...BASE_PROPS} />);
    fireEvent.change(screen.getByLabelText("Buscar conversaciones por contacto"), {
      target: { value: "juan" },
    });
    expect(BASE_PROPS.onSearchChange).toHaveBeenCalledWith("juan");
  });

  it("calls onStatusChange when selecting a status", async () => {
    render(<ConversationFilters {...BASE_PROPS} />);
    await userEvent.selectOptions(screen.getByLabelText("Estado:"), "active");
    expect(BASE_PROPS.onStatusChange).toHaveBeenCalledWith("active");
  });

  it("calls onDateFromChange with date value", () => {
    render(<ConversationFilters {...BASE_PROPS} />);
    fireEvent.change(screen.getByLabelText("Desde:"), { target: { value: "2026-01-01" } });
    expect(BASE_PROPS.onDateFromChange).toHaveBeenCalledWith("2026-01-01");
  });

  it("calls onDateToChange with null when cleared", () => {
    render(
      <ConversationFilters {...BASE_PROPS} dateTo="2026-06-30" />
    );
    fireEvent.change(screen.getByLabelText("Hasta:"), { target: { value: "" } });
    expect(BASE_PROPS.onDateToChange).toHaveBeenCalledWith(null);
  });

  it("disables clear button when no filters are active", () => {
    render(<ConversationFilters {...BASE_PROPS} />);
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeDisabled();
  });

  it("enables clear button and calls onClear", async () => {
    render(
      <ConversationFilters {...BASE_PROPS} search="juan" statusFilter="active" />
    );
    const clear = screen.getByRole("button", { name: "Limpiar filtros" });
    expect(clear).not.toBeDisabled();
    await userEvent.click(clear);
    expect(BASE_PROPS.onClear).toHaveBeenCalledTimes(1);
  });

  it("shows active filter count badge", () => {
    render(
      <ConversationFilters {...BASE_PROPS} search="juan" statusFilter="closed" />
    );
    expect(screen.getByText("2 activos")).toBeInTheDocument();
    expect(screen.getByLabelText("2 filtros activos")).toBeInTheDocument();
  });

  it("shows singular badge with one active filter", () => {
    render(
      <ConversationFilters {...BASE_PROPS} dateTo="2026-06-30" />
    );
    expect(screen.getByText("1 activo")).toBeInTheDocument();
  });

  it("hides badge when no filters are active", () => {
    render(<ConversationFilters {...BASE_PROPS} />);
    expect(screen.queryByText(/activo/)).not.toBeInTheDocument();
  });
});
