import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageFilters } from "@/components/workspace/MessageFilters";

const BASE_PROPS = {
  search: "",
  directionFilter: "",
  statusFilter: "",
  dateFrom: null,
  dateTo: null,
  onSearchChange: vi.fn(),
  onDirectionChange: vi.fn(),
  onStatusChange: vi.fn(),
  onDateFromChange: vi.fn(),
  onDateToChange: vi.fn(),
  onClear: vi.fn(),
};

describe("MessageFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search, direction, status, dates and clear button", () => {
    render(<MessageFilters {...BASE_PROPS} />);
    expect(screen.getByLabelText("Buscar en mensajes")).toBeInTheDocument();
    expect(screen.getByLabelText("Dirección:")).toBeInTheDocument();
    expect(screen.getByLabelText("Estado:")).toBeInTheDocument();
    expect(screen.getByLabelText("Desde:")).toBeInTheDocument();
    expect(screen.getByLabelText("Hasta:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument();
  });

  it("renders direction options", () => {
    render(<MessageFilters {...BASE_PROPS} />);
    expect(screen.getByText("Todas")).toBeInTheDocument();
    expect(screen.getByText("Entrantes")).toBeInTheDocument();
    expect(screen.getByText("Salientes")).toBeInTheDocument();
  });

  it("renders message status options", () => {
    render(<MessageFilters {...BASE_PROPS} />);
    expect(screen.getByText("Todos")).toBeInTheDocument();
    expect(screen.getByText("Enviados")).toBeInTheDocument();
    expect(screen.getByText("Entregados")).toBeInTheDocument();
    expect(screen.getByText("Leídos")).toBeInTheDocument();
    expect(screen.getByText("Fallidos")).toBeInTheDocument();
  });

  it("calls onSearchChange when typing", () => {
    render(<MessageFilters {...BASE_PROPS} />);
    fireEvent.change(screen.getByLabelText("Buscar en mensajes"), {
      target: { value: "pedido" },
    });
    expect(BASE_PROPS.onSearchChange).toHaveBeenCalledWith("pedido");
  });

  it("calls onDirectionChange when selecting a direction", async () => {
    render(<MessageFilters {...BASE_PROPS} />);
    await userEvent.selectOptions(screen.getByLabelText("Dirección:"), "incoming");
    expect(BASE_PROPS.onDirectionChange).toHaveBeenCalledWith("incoming");
  });

  it("calls onStatusChange when selecting a status", async () => {
    render(<MessageFilters {...BASE_PROPS} />);
    await userEvent.selectOptions(screen.getByLabelText("Estado:"), "failed");
    expect(BASE_PROPS.onStatusChange).toHaveBeenCalledWith("failed");
  });

  it("calls onDateFromChange with date value", () => {
    render(<MessageFilters {...BASE_PROPS} />);
    fireEvent.change(screen.getByLabelText("Desde:"), { target: { value: "2026-01-01" } });
    expect(BASE_PROPS.onDateFromChange).toHaveBeenCalledWith("2026-01-01");
  });

  it("calls onDateToChange with null when cleared", () => {
    render(
      <MessageFilters {...BASE_PROPS} dateTo="2026-06-30" />
    );
    fireEvent.change(screen.getByLabelText("Hasta:"), { target: { value: "" } });
    expect(BASE_PROPS.onDateToChange).toHaveBeenCalledWith(null);
  });

  it("disables clear button when no filters are active", () => {
    render(<MessageFilters {...BASE_PROPS} />);
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeDisabled();
  });

  it("enables clear button and calls onClear", async () => {
    render(
      <MessageFilters {...BASE_PROPS} search="pedido" directionFilter="outgoing" />
    );
    const clear = screen.getByRole("button", { name: "Limpiar filtros" });
    expect(clear).not.toBeDisabled();
    await userEvent.click(clear);
    expect(BASE_PROPS.onClear).toHaveBeenCalledTimes(1);
  });

  it("shows active filter count badge", () => {
    render(
      <MessageFilters {...BASE_PROPS} search="pedido" statusFilter="failed" dateFrom="2026-01-01" />
    );
    expect(screen.getByText("3 activos")).toBeInTheDocument();
    expect(screen.getByLabelText("3 filtros activos")).toBeInTheDocument();
  });

  it("hides badge when no filters are active", () => {
    render(<MessageFilters {...BASE_PROPS} />);
    expect(screen.queryByText(/activo/)).not.toBeInTheDocument();
  });

  it("shows result counter when search is active", () => {
    render(
      <MessageFilters {...BASE_PROPS} search="pedido" resultCount={3} totalResults={10} />
    );
    expect(screen.getByText("3 de 10 resultados")).toBeInTheDocument();
  });

  it("hides result counter when search is empty", () => {
    render(<MessageFilters {...BASE_PROPS} resultCount={3} totalResults={10} />);
    expect(screen.queryByText(/resultados/)).not.toBeInTheDocument();
  });

  it("hides result counter when total is not available", () => {
    render(<MessageFilters {...BASE_PROPS} search="pedido" resultCount={3} />);
    expect(screen.queryByText(/resultados/)).not.toBeInTheDocument();
  });

  it("shows Ctrl+F shortcut hint when search is empty", () => {
    render(<MessageFilters {...BASE_PROPS} />);
    expect(screen.getByText("Ctrl+F")).toBeInTheDocument();
  });

  it("hides Ctrl+F shortcut hint while typing", () => {
    render(<MessageFilters {...BASE_PROPS} search="pedido" />);
    expect(screen.queryByText("Ctrl+F")).not.toBeInTheDocument();
  });
});
