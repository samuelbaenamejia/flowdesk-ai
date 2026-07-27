import { render, screen } from "@testing-library/react";
import React from "react";
import Sidebar from "@/components/layout/Sidebar";

vi.mock("next/link", () => ({
  default: React.forwardRef(function Link(props: any, ref: any) {
    return React.createElement("a", { ref, href: props.href, title: props.title, className: props.className }, props.children);
  }),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ pathname: "/conversations" }),
}));

describe("Sidebar", () => {
  it("renders brand abbreviation", () => {
    render(<Sidebar />);
    expect(screen.getByText("F")).toBeInTheDocument();
  });

  it("renders conversations icon link", () => {
    render(<Sidebar />);
    const link = screen.getByTitle("Conversaciones");
    expect(link).toBeInTheDocument();
  });

  it("highlights active route", () => {
    render(<Sidebar />);
    const link = screen.getByTitle("Conversaciones");
    expect(link.className).toContain("bg-gray-100");
  });

  it("does not render Home", () => {
    render(<Sidebar />);
    expect(screen.queryByTitle("Home")).not.toBeInTheDocument();
  });
});
