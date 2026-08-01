import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Mensajes hoy" value="1.204" />);
    expect(screen.getByText("Mensajes hoy")).toBeInTheDocument();
    expect(screen.getByText("1.204")).toBeInTheDocument();
  });

  it("renders the icon when provided", () => {
    render(<StatCard label="Conversaciones" value="245" icon={Inbox} />);
    const icon = document.querySelector("svg.lucide-inbox");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("does not render an icon container when icon is not provided", () => {
    const { container } = render(<StatCard label="Tasa" value="92%" />);
    expect(container.querySelector("span svg")).not.toBeInTheDocument();
  });
});
