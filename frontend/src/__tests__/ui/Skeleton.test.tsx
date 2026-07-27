import { render } from "@testing-library/react";
import { Skeleton } from "@/components/ui/Skeleton";

describe("Skeleton", () => {
  it("renders with text variant by default", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("animate-pulse");
  });

  it("renders title variant", () => {
    const { container } = render(<Skeleton variant="title" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-6");
    expect(el.className).toContain("w-48");
  });

  it("renders avatar variant", () => {
    const { container } = render(<Skeleton variant="avatar" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-10");
    expect(el.className).toContain("rounded-full");
  });

  it("renders row variant", () => {
    const { container } = render(<Skeleton variant="row" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-12");
  });

  it("applies custom width and height", () => {
    const { container } = render(<Skeleton width="200px" height="50px" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("200px");
    expect(el.style.height).toBe("50px");
  });

  it("merges custom className", () => {
    const { container } = render(<Skeleton className="custom" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("custom");
  });

  it("has aria-hidden", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
