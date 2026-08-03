import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "@/components/workspace/Composer";

describe("Composer", () => {
  it("renders textarea and send button", () => {
    render(<Composer onSend={vi.fn()} disabled={false} sending={false} error={null} />);

    expect(screen.getByPlaceholderText("Escribe un mensaje...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar mensaje/i })).toBeInTheDocument();
  });

  it("disables send button when textarea is empty", () => {
    render(<Composer onSend={vi.fn()} disabled={false} sending={false} error={null} />);

    expect(screen.getByRole("button", { name: /enviar mensaje/i })).toBeDisabled();
  });

  it("enables send button when textarea has text", async () => {
    const user = userEvent.setup();
    render(<Composer onSend={vi.fn()} disabled={false} sending={false} error={null} />);

    const textarea = screen.getByPlaceholderText("Escribe un mensaje...");
    await user.type(textarea, "Hola");

    expect(screen.getByRole("button", { name: /enviar mensaje/i })).not.toBeDisabled();
  });

  it("disables textarea and button during sending", () => {
    render(<Composer onSend={vi.fn()} disabled={false} sending={true} error={null} />);

    expect(screen.getByPlaceholderText("Escribe un mensaje...")).toBeDisabled();
    expect(screen.getByRole("button", { name: /enviar mensaje/i })).toBeDisabled();
  });

  it("calls onSend when Enter is pressed", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Composer onSend={onSend} disabled={false} sending={false} error={null} />);

    const textarea = screen.getByPlaceholderText("Escribe un mensaje...");
    await user.type(textarea, "Mensaje de prueba");
    await user.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith("Mensaje de prueba");
  });

  it("does not call onSend with Shift+Enter", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Composer onSend={onSend} disabled={false} sending={false} error={null} />);

    const textarea = screen.getByPlaceholderText("Escribe un mensaje...");
    await user.type(textarea, "Mensaje");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("calls onSend with Ctrl+Enter", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Composer onSend={onSend} disabled={false} sending={false} error={null} />);

    const textarea = screen.getByPlaceholderText("Escribe un mensaje...");
    await user.type(textarea, "Mensaje por atajo");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(onSend).toHaveBeenCalledWith("Mensaje por atajo");
  });

  it("calls onSend with Cmd+Enter", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Composer onSend={onSend} disabled={false} sending={false} error={null} />);

    const textarea = screen.getByPlaceholderText("Escribe un mensaje...");
    await user.type(textarea, "Mensaje mac");
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    expect(onSend).toHaveBeenCalledWith("Mensaje mac");
  });

  it("shows error message when error prop is not null", () => {
    render(
      <Composer onSend={vi.fn()} disabled={false} sending={false} error="Error de envío" />
    );

    expect(screen.getByText("Error de envío")).toBeInTheDocument();
  });

  it("error has role alert", () => {
    render(
      <Composer onSend={vi.fn()} disabled={false} sending={false} error="Error" />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Error");
  });

  it("does not call onSend when sending is true", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { rerender } = render(
      <Composer onSend={onSend} disabled={false} sending={false} error={null} />
    );

    const textarea = screen.getByPlaceholderText("Escribe un mensaje...");
    await user.type(textarea, "Hola");

    rerender(<Composer onSend={onSend} disabled={false} sending={true} error={null} />);

    const button = screen.getByRole("button", { name: /enviar mensaje/i });
    await user.click(button);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("textarea has correct aria-label", () => {
    render(<Composer onSend={vi.fn()} disabled={false} sending={false} error={null} />);

    expect(screen.getByPlaceholderText("Escribe un mensaje...")).toHaveAttribute(
      "aria-label",
      "Escribe un mensaje"
    );
  });
});
