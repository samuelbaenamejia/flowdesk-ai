import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageList } from "@/components/workspace/MessageList";
import { formatDateGroupLabel, getDateGroupKey } from "@/components/conversations/DateGroup";
import type { Message } from "@/types";

async function flushRaf() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

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

  it("renders contextual empty state with search active", () => {
    render(
      <MessageList
        messages={[]}
        loading={false}
        hasMore={false}
        onLoadMore={vi.fn()}
        searchActive
        searchQuery="pedido"
      />
    );

    expect(screen.getByText('Sin resultados para "pedido"')).toBeInTheDocument();
  });

  it("renders generic empty state when search active without query", () => {
    render(
      <MessageList
        messages={[]}
        loading={false}
        hasMore={false}
        onLoadMore={vi.fn()}
        searchActive
      />
    );

    expect(screen.getByText("No hay mensajes que coincidan")).toBeInTheDocument();
  });

  it("renders messages when search is active", () => {
    render(
      <MessageList
        messages={messages}
        loading={false}
        hasMore={false}
        onLoadMore={vi.fn()}
        searchActive
        searchQuery="Hola"
      />
    );

    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(screen.getByText("Adiós")).toBeInTheDocument();
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

  it("groups messages by local date with expandable headers", async () => {
    const multiDayMessages: Message[] = [
      ...messages,
      { ...messages[0], id: "m3", content: "Mensaje antiguo", created_at: "2026-07-26T10:00:00Z" },
    ];
    render(
      <MessageList
        messages={multiDayMessages}
        loading={false}
        hasMore={false}
        onLoadMore={vi.fn()}
      />
    );

    const firstDay = formatDateGroupLabel(
      getDateGroupKey(new Date("2026-07-27T10:00:00Z"))
    );
    const secondDay = formatDateGroupLabel(
      getDateGroupKey(new Date("2026-07-26T10:00:00Z"))
    );
    expect(screen.getByRole("button", { name: new RegExp(firstDay) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(secondDay) })).toBeInTheDocument();

    const firstGroupButton = screen.getByRole("button", { name: new RegExp(firstDay) });
    expect(firstGroupButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Hola")).toBeInTheDocument();

    await userEvent.click(firstGroupButton);
    expect(screen.queryByText("Hola")).not.toBeInTheDocument();
    expect(screen.getByText("Mensaje antiguo")).toBeInTheDocument();
    expect(firstGroupButton).toHaveAttribute("aria-expanded", "false");
    expect(firstGroupButton).toHaveTextContent("2 mensajes");
  });

  it("renders a flat list without group headers when search is active", () => {
    render(
      <MessageList
        messages={messages}
        loading={false}
        hasMore={false}
        onLoadMore={vi.fn()}
        searchActive
        searchQuery="Hola"
      />
    );

    expect(screen.queryByRole("button", { name: /Hoy/ })).not.toBeInTheDocument();
    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(screen.getByText("Adiós")).toBeInTheDocument();
  });

  it("expands the group of the deep-linked message", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const dayKey = getDateGroupKey(new Date("2026-07-27T10:00:00Z"));
    const label = formatDateGroupLabel(dayKey);

    const { rerender } = render(
      <MessageList messages={messages} loading={false} hasMore={false} onLoadMore={vi.fn()} />
    );
    await userEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
    expect(screen.queryByText("Hola")).not.toBeInTheDocument();

    rerender(
      <MessageList
        messages={messages}
        loading={false}
        hasMore={false}
        onLoadMore={vi.fn()}
        scrollToMessageId="m1"
      />
    );

    expect(screen.getByRole("button", { name: new RegExp(label) })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("reports near-bottom changes through onNearBottomChange", async () => {
    const onNearBottomChange = vi.fn();
    render(
      <MessageList
        messages={messages}
        loading={false}
        hasMore={false}
        onLoadMore={vi.fn()}
        onNearBottomChange={onNearBottomChange}
      />
    );

    const container = document.querySelector('[role="log"]') as HTMLElement;
    Object.defineProperty(container, "scrollTop", { value: 0, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 600, configurable: true });
    Object.defineProperty(container, "scrollHeight", { value: 2000, configurable: true });
    fireEvent.scroll(container);
    await flushRaf();

    expect(onNearBottomChange).toHaveBeenCalledWith(false);
  });

  it("does not auto-scroll on new messages when scrolled away from the bottom", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(
      <MessageList messages={messages} loading={false} hasMore={false} onLoadMore={vi.fn()} />
    );

    const container = document.querySelector('[role="log"]') as HTMLElement;
    Object.defineProperty(container, "scrollTop", { value: 0, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 600, configurable: true });
    Object.defineProperty(container, "scrollHeight", { value: 2000, configurable: true });
    fireEvent.scroll(container);
    await flushRaf();

    const extra: Message[] = [
      ...messages,
      { ...messages[0], id: "m9", created_at: "2026-07-27T11:00:00Z" },
    ];
    rerender(
      <MessageList messages={extra} loading={false} hasMore={false} onLoadMore={vi.fn()} />
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("auto-scrolls on new messages when near the bottom", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(
      <MessageList messages={messages} loading={false} hasMore={false} onLoadMore={vi.fn()} />
    );

    const container = document.querySelector('[role="log"]') as HTMLElement;
    Object.defineProperty(container, "scrollTop", { value: 1500, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 600, configurable: true });
    Object.defineProperty(container, "scrollHeight", { value: 2000, configurable: true });
    fireEvent.scroll(container);
    await flushRaf();

    const extra: Message[] = [
      ...messages,
      { ...messages[0], id: "m9", created_at: "2026-07-27T11:00:00Z" },
    ];
    rerender(
      <MessageList messages={extra} loading={false} hasMore={false} onLoadMore={vi.fn()} />
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
