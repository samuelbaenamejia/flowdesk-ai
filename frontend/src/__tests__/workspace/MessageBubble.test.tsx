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

  it("wraps matching terms in mark, case-insensitive", () => {
    const message = {
      ...inboundMessage,
      content: "El PEDIDO llegó mañana. Mi pedido ya viene.",
    };
    const { container } = render(<MessageBubble message={message} highlightTerm="pedido" />);

    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe("PEDIDO");
    expect(marks[1].textContent).toBe("pedido");
    expect(container.querySelector("p")?.textContent).toBe(
      "El PEDIDO llegó mañana. Mi pedido ya viene."
    );
  });

  it("escapes regex special characters in the search term", () => {
    const message = {
      ...inboundMessage,
      content: "¿Costo total? (incluye IVA)",
    };
    const { container } = render(
      <MessageBubble message={message} highlightTerm="(incluye" />
    );

    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("(incluye");
  });

  it("renders plain text without marks when no term is provided", () => {
    const { container } = render(<MessageBubble message={inboundMessage} />);

    expect(container.querySelectorAll("mark").length).toBe(0);
    expect(screen.getByText("Hola, ¿cómo estás?")).toBeInTheDocument();
  });

  it("does not use dangerouslySetInnerHTML for highlighting", () => {
    const message = { ...inboundMessage, content: "Hola mundo" };
    const { container } = render(
      <MessageBubble message={message} highlightTerm="mundo" />
    );

    expect(container.innerHTML).not.toMatch(/dangerouslySetInnerHTML|dangerouslysetinnerhtml/i);
    expect(container.querySelector("mark")?.textContent).toBe("mundo");
  });
});
