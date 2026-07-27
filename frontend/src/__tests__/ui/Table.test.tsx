import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table } from "@/components/ui/Table";

const headers = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
];

const rows = [
  { name: "Alice", role: "Admin" },
  { name: "Bob", role: "User" },
];

const getRowKey = (row: Record<string, unknown>) => row.name as string;

describe("Table", () => {
  it("renders headers", () => {
    render(<Table headers={headers} rows={rows} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
  });

  it("falls back to index key when no getRowKey", () => {
    const { container } = render(<Table headers={headers} rows={rows} />);
    expect(container.querySelector("tbody")?.children.length).toBe(2);
  });

  it("renders rows", () => {
    render(<Table headers={headers} rows={rows} getRowKey={getRowKey} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("calls onRowClick when a row is clicked", async () => {
    const onRowClick = vi.fn();
    render(<Table headers={headers} rows={rows} onRowClick={onRowClick} getRowKey={getRowKey} />);
    await userEvent.click(screen.getByText("Alice"));
    expect(onRowClick).toHaveBeenCalledWith(0);
  });

  it("applies hover styles when clickable", () => {
    render(<Table headers={headers} rows={rows} onRowClick={() => {}} getRowKey={getRowKey} />);
    const rows_ = screen.getByText("Alice").closest("tr");
    expect(rows_?.className).toContain("cursor-pointer");
  });

  it("calls onRowClick on Enter key", async () => {
    const onRowClick = vi.fn();
    render(<Table headers={headers} rows={rows} onRowClick={onRowClick} getRowKey={getRowKey} />);
    const row = screen.getByText("Alice").closest("tr");
    row?.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledWith(0);
  });

  it("calls onRowClick on Space key", async () => {
    const onRowClick = vi.fn();
    render(<Table headers={headers} rows={rows} onRowClick={onRowClick} getRowKey={getRowKey} />);
    const row = screen.getByText("Bob").closest("tr");
    row?.focus();
    await userEvent.keyboard(" ");
    expect(onRowClick).toHaveBeenCalledWith(1);
  });

  it("sets tabIndex and role on clickable rows", () => {
    render(<Table headers={headers} rows={rows} onRowClick={() => {}} getRowKey={getRowKey} />);
    const row = screen.getByText("Alice").closest("tr");
    expect(row).toHaveAttribute("tabindex", "0");
    expect(row).toHaveAttribute("role", "button");
  });
});
