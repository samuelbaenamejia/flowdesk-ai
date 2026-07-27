import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/Input";

describe("Input", () => {
  it("renders with label", () => {
    render(<Input label="Email" id="email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders error message", () => {
    render(<Input label="Email" error="Required field" id="email" />);
    expect(screen.getByText("Required field")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders helper text", () => {
    render(<Input label="Email" helperText="Enter your email" id="email" />);
    expect(screen.getByText("Enter your email")).toBeInTheDocument();
  });

  it("does not render helper text when error exists", () => {
    render(
      <Input label="Email" error="Error" helperText="Helper" id="email" />
    );
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.queryByText("Helper")).not.toBeInTheDocument();
  });

  it("calls onChange when typing", async () => {
    const onChange = vi.fn();
    render(<Input label="Name" onChange={onChange} id="name" />);
    await userEvent.type(screen.getByLabelText("Name"), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("disables input when disabled", () => {
    render(<Input label="Disabled" disabled id="disabled" />);
    expect(screen.getByLabelText("Disabled")).toBeDisabled();
  });

  it("applies error border styles", () => {
    render(<Input label="Email" error="Required" id="email" />);
    expect(screen.getByRole("textbox").className).toContain("border-red-300");
  });

  it("generates id via useId when no id provided", () => {
    render(<Input label="Full Name" />);
    expect(screen.getByLabelText("Full Name")).toHaveAttribute("id");
  });

  it("renders without label", () => {
    render(<Input placeholder="no label" />);
    expect(screen.getByPlaceholderText("no label")).toBeInTheDocument();
  });
});
