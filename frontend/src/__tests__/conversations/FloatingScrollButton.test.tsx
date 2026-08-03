import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingScrollButton } from "@/components/conversations/FloatingScrollButton";

describe("FloatingScrollButton", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(
      <FloatingScrollButton visible={false} count={3} onClick={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a button with aria-label when visible", () => {
    render(<FloatingScrollButton visible count={0} onClick={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Ir al final y ver mensajes nuevos" })
    ).toBeInTheDocument();
  });

  it("shows the badge with the new messages count", () => {
    render(<FloatingScrollButton visible count={3} onClick={vi.fn()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps the badge at 99+", () => {
    render(<FloatingScrollButton visible count={150} onClick={vi.fn()} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("does not render a badge when count is zero", () => {
    render(<FloatingScrollButton visible count={0} onClick={vi.fn()} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<FloatingScrollButton visible count={1} onClick={onClick} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Ir al final y ver mensajes nuevos" })
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
