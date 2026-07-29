import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageList } from "@/components/workspace/MessageList";
import type { Message } from "@/types";

const messages: Message[] = [
  {
    id: "m1",
    conversation_id: "1",
    direction: "incoming",
    content_type: "text",
    content: "Hola",
    wa_message_id: null,
    status: "sent",
    created_at: "2026-07-27T10:00:00Z",
  },
  {
    id: "m2",
    conversation_id: "1",
    direction: "outgoing",
    content_type: "text",
    content: "Adiós",
    wa_message_id: null,
    status: "delivered",
    created_at: "2026-07-27T10:30:00Z",
  },
];

describe("MessageList", () => {
  it("renders MessageBubble for each message", () => {
    render(
      <MessageList messages={messages} loading={false} hasMore={false} onLoadMore={vi.fn()} />
    );

    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(screen.getByText("Adiós")).toBeInTheDocument();
  });

  it("renders skeletons when loading with no messages", () => {
    const { container } = render(
      <MessageList messages={[]} loading={true} hasMore={false} onLoadMore={vi.fn()} />
    );

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(5);
  });

  it("renders EmptyState when no messages and not loading", () => {
    render(
      <MessageList messages={[]} loading={false} hasMore={false} onLoadMore={vi.fn()} />
    );

    expect(screen.getByText("No hay mensajes")).toBeInTheDocument();
  });

  it("renders load more button when hasMore is true", () => {
    render(
      <MessageList messages={messages} loading={false} hasMore={true} onLoadMore={vi.fn()} />
    );

    expect(screen.getByText("Cargar más mensajes")).toBeInTheDocument();
  });

  it("does not render load more button when hasMore is false", () => {
    render(
      <MessageList messages={messages} loading={false} hasMore={false} onLoadMore={vi.fn()} />
    );

    expect(screen.queryByText("Cargar más mensajes")).not.toBeInTheDocument();
  });

  it("calls onLoadMore when load more button is clicked", async () => {
    const onLoadMore = vi.fn();
    render(
      <MessageList messages={messages} loading={false} hasMore={true} onLoadMore={onLoadMore} />
    );

    await userEvent.click(screen.getByText("Cargar más mensajes"));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("has correct accessibility attributes", () => {
    const { container } = render(
      <MessageList messages={messages} loading={false} hasMore={false} onLoadMore={vi.fn()} />
    );

    const log = container.querySelector('[role="log"]');
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-label", "Mensajes de la conversación");
  });
});
