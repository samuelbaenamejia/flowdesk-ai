import { render, screen, fireEvent } from "@testing-library/react";
import { MessagesChart } from "@/components/dashboard/MessagesChart";
import type { MessagesOverTimePoint } from "@/types";

const data: MessagesOverTimePoint[] = [
  { date: "2026-07-01", count: 0 },
  { date: "2026-07-02", count: 4 },
  { date: "2026-07-03", count: 12 },
  { date: "2026-07-04", count: 2 },
];

describe("MessagesChart", () => {
  it("renders the chart with an accessible summary", () => {
    render(<MessagesChart data={data} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /Mensajes de los últimos 30 días.*Total: 18.*Máximo diario: 12/
    );
  });

  it("renders one point per data entry", () => {
    const { container } = render(<MessagesChart data={data} />);
    const points = container.querySelectorAll(".pointer-events-auto");
    expect(points).toHaveLength(4);
  });

  it("renders the first, middle and last date labels", () => {
    render(<MessagesChart data={data} />);
    expect(screen.getByText("1 jul")).toBeInTheDocument();
    expect(screen.getByText("2 jul")).toBeInTheDocument();
    expect(screen.getByText("4 jul")).toBeInTheDocument();
  });

  it("shows a tooltip with date and count on hover", () => {
    const { container } = render(<MessagesChart data={data} />);
    const points = container.querySelectorAll(".pointer-events-auto");
    fireEvent.mouseEnter(points[2]);
    expect(screen.getByRole("tooltip")).toHaveTextContent("3 jul: 12 mensajes");
  });

  it("hides the tooltip when leaving the point", () => {
    const { container } = render(<MessagesChart data={data} />);
    const points = container.querySelectorAll(".pointer-events-auto");
    fireEvent.mouseEnter(points[1]);
    expect(screen.getByRole("tooltip")).toHaveTextContent("4 mensajes");
    fireEvent.mouseLeave(points[1]);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("renders the singular message form for a count of 1", () => {
    const { container } = render(
      <MessagesChart data={[{ date: "2026-07-02", count: 1 }]} />
    );
    const points = container.querySelectorAll(".pointer-events-auto");
    fireEvent.mouseEnter(points[0]);
    expect(screen.getByRole("tooltip")).toHaveTextContent("2 jul: 1 mensaje");
  });

  it("renders an empty state when there is no data", () => {
    render(<MessagesChart data={[]} />);
    expect(screen.getByText("Sin datos de mensajes para mostrar")).toBeInTheDocument();
  });
});
