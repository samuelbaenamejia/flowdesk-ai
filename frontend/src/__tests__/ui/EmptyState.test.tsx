import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState icon={Inbox} title="No items" />);
    expect(screen.getByText("No items")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(
      <EmptyState icon={Inbox} title="Empty" description="Nothing here yet" />
    );
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders action button and calls onClick", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Inbox}
        title="Empty"
        action={{ label: "Create", onClick }}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
