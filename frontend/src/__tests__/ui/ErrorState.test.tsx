import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "@/components/ui/ErrorState";

describe("ErrorState", () => {
  it("renders message", () => {
    render(<ErrorState message="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders title", () => {
    render(<ErrorState title="Error" message="Failed to load" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("renders retry button and calls onRetry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Failed" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
