import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "@/components/ui/SearchBar";

describe("SearchBar", () => {
  it("renders input with aria-label and placeholder", () => {
    render(
      <SearchBar
        value=""
        onChange={() => {}}
        ariaLabel="Buscar conversaciones"
        placeholder="Buscar..."
      />
    );
    const input = screen.getByLabelText("Buscar conversaciones");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Buscar...");
  });

  it("calls onChange when typing", () => {
    const onChange = vi.fn();
    render(
      <SearchBar value="" onChange={onChange} ariaLabel="Buscar conversaciones" />
    );
    fireEvent.change(screen.getByLabelText("Buscar conversaciones"), {
      target: { value: "ana" },
    });
    expect(onChange).toHaveBeenCalledWith("ana");
  });

  it("shows clear button only when there is a value", () => {
    const { rerender } = render(
      <SearchBar value="" onChange={() => {}} ariaLabel="Buscar conversaciones" />
    );
    expect(screen.queryByLabelText("Limpiar búsqueda")).not.toBeInTheDocument();

    rerender(
      <SearchBar value="ana" onChange={() => {}} ariaLabel="Buscar conversaciones" />
    );
    expect(screen.getByLabelText("Limpiar búsqueda")).toBeInTheDocument();
  });

  it("clears value when clicking clear button", async () => {
    const onChange = vi.fn();
    render(
      <SearchBar value="ana" onChange={onChange} ariaLabel="Buscar conversaciones" />
    );
    await userEvent.click(screen.getByLabelText("Limpiar búsqueda"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("clears and blurs on Escape", async () => {
    const onChange = vi.fn();
    render(
      <SearchBar value="ana" onChange={onChange} ariaLabel="Buscar conversaciones" />
    );
    const input = screen.getByLabelText("Buscar conversaciones");
    input.focus();
    await userEvent.keyboard("{Escape}");
    expect(onChange).toHaveBeenCalledWith("");
    expect(input).not.toHaveFocus();
  });

  it("shows shortcut hint when empty and enabled", () => {
    render(
      <SearchBar
        value=""
        onChange={() => {}}
        ariaLabel="Buscar conversaciones"
        showShortcutHint
      />
    );
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("hides shortcut hint when there is a value", () => {
    render(
      <SearchBar
        value="ana"
        onChange={() => {}}
        ariaLabel="Buscar conversaciones"
        showShortcutHint
      />
    );
    expect(screen.queryByText("/")).not.toBeInTheDocument();
  });
});
