import { render, screen } from "@testing-library/react";
import { MessageBubble } from "@/components/workspace/MessageBubble";
import type { Message } from "@/types";

const inboundMessage: Message = {
  id: "m1",
  conversation_id: "1",
  direction: "incoming",
  content_type: "text",
  content: "Hola, ¿cómo estás?",
  wa_message_id: null,
  status: "sent",
  created_at: "2026-07-27T10:30:00Z",
};

const outboundMessage: Message = {
  ...inboundMessage,
  id: "m2",
  direction: "outgoing",
  content: "¡Bien, gracias!",
  status: "delivered",
};

const failedMessage: Message = {
  ...inboundMessage,
  id: "m3",
  direction: "outgoing",
  content: "Mensaje fallido",
  status: "failed",
};

const longContentMessage: Message = {
  ...inboundMessage,
  id: "m4",
  content: "a".repeat(1500),
};

describe("MessageBubble", () => {
  it("renders inbound message with gray background and left alignment", () => {
    const { container } = render(<MessageBubble message={inboundMessage} />);

    expect(screen.getByText("Hola, ¿cómo estás?")).toBeInTheDocument();
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-start");
  });

  it("renders outbound message with blue background and right alignment", () => {
    const { container } = render(<MessageBubble message={outboundMessage} />);

    expect(screen.getByText("¡Bien, gracias!")).toBeInTheDocument();
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-end");
  });

  it("shows delivery status for outbound messages", () => {
    render(<MessageBubble message={outboundMessage} />);

    expect(screen.getByText("entregado")).toBeInTheDocument();
  });

  it("shows 'fallido' for failed outbound messages", () => {
    render(<MessageBubble message={failedMessage} />);

    expect(screen.getByText("fallido")).toBeInTheDocument();
  });

  it("renders timestamp with time element", () => {
    render(<MessageBubble message={inboundMessage} />);

    const time = screen.getByText(/^\d{2}:\d{2}$/);
    expect(time).toBeInTheDocument();
    expect(time.tagName).toBe("TIME");
  });

  it("handles very long content without horizontal overflow", () => {
    const { container } = render(<MessageBubble message={longContentMessage} />);

    const bubble = container.querySelector(".break-words");
    expect(bubble).toBeInTheDocument();
    expect(bubble?.textContent?.length).toBe(1500);
  });

  it("does not show status for inbound messages", () => {
    render(<MessageBubble message={inboundMessage} />);

    expect(screen.queryByText("sent")).not.toBeInTheDocument();
  });
});
