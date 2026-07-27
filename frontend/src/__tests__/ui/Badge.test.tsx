import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies default variant", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default").className).toContain("bg-gray-100");
  });

  it("applies success variant", () => {
    render(<Badge variant="success">Success</Badge>);
    expect(screen.getByText("Success").className).toContain("bg-green-50");
  });

  it("applies warning variant", () => {
    render(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText("Warning").className).toContain("bg-yellow-50");
  });

  it("applies info variant", () => {
    render(<Badge variant="info">Info</Badge>);
    expect(screen.getByText("Info").className).toContain("bg-blue-50");
  });

  it("applies error variant", () => {
    render(<Badge variant="error">Error</Badge>);
    expect(screen.getByText("Error").className).toContain("bg-red-50");
  });
});
