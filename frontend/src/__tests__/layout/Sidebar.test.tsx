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
    render(<Sidebar isOpen onClose={() => {}} />);
    expect(screen.getByText("F")).toBeInTheDocument();
  });

  it("renders conversations icon link", () => {
    render(<Sidebar isOpen onClose={() => {}} />);
    const link = screen.getByTitle("Conversaciones");
    expect(link).toBeInTheDocument();
  });

  it("renders dashboard link first", () => {
    render(<Sidebar isOpen onClose={() => {}} />);
    const dashboard = screen.getByTitle("Dashboard");
    expect(dashboard).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links[0].title).toBe("Dashboard");
  });

  it("highlights active route", () => {
    render(<Sidebar isOpen onClose={() => {}} />);
    const link = screen.getByTitle("Conversaciones");
    expect(link.className).toContain("bg-gray-100");
  });

  it("does not render Home", () => {
    render(<Sidebar isOpen onClose={() => {}} />);
    expect(screen.queryByTitle("Home")).not.toBeInTheDocument();
  });
});
