import { render } from "@testing-library/react";
import { useRouter } from "next/router";
import { vi } from "vitest";
import type { Mock } from "vitest";
import HomePage from "@/pages/index";

vi.mock("next/router", () => ({
  useRouter: vi.fn(),
}));

describe("HomePage", () => {
  it("redirects to the dashboard on mount", () => {
    const replace = vi.fn();
    (useRouter as Mock).mockReturnValue({ replace });
    render(<HomePage />);
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });
});
