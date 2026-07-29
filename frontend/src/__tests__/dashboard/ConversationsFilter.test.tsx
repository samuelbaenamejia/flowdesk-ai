import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationsFilter } from "@/components/dashboard/ConversationsFilter";

describe("ConversationsFilter", () => {
  it("renders with the current value selected", () => {
    render(<ConversationsFilter value="active" onChange={() => {}} />);
    const select = screen.getByLabelText("Filtrar:") as HTMLSelectElement;
    expect(select.value).toBe("active");
  });

  it("calls onChange when selecting an option", async () => {
    const onChange = vi.fn();
    render(<ConversationsFilter value="" onChange={onChange} />);
    const select = screen.getByLabelText("Filtrar:");
    await userEvent.selectOptions(select, "active");
    expect(onChange).toHaveBeenCalledWith("active");
  });

  it("renders all four options", () => {
    render(<ConversationsFilter value="" onChange={() => {}} />);
    expect(screen.getByText("Todas")).toBeInTheDocument();
    expect(screen.getByText("Activas")).toBeInTheDocument();
    expect(screen.getByText("Human Takeover")).toBeInTheDocument();
    expect(screen.getByText("Cerradas")).toBeInTheDocument();
  });

  it("has accessible label", () => {
    render(<ConversationsFilter value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Filtrar:")).toBeInTheDocument();
  });
});
