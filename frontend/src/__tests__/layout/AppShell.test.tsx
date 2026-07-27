import { render, screen } from "@testing-library/react";
import React from "react";
import AppShell from "@/components/layout/AppShell";

vi.mock("@/components/layout/Sidebar", () => ({
  default: function MockSidebar() {
    return React.createElement("div", { "data-testid": "sidebar" }, "FlowDesk-AI");
  },
}));

vi.mock("@/components/layout/Header", () => ({
  default: function MockHeader() {
    return React.createElement("div", { "data-testid": "header" }, "Dashboard");
  },
}));

describe("AppShell", () => {
  it("renders sidebar", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("renders header", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(<AppShell><p>Hello World</p></AppShell>);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });
});
