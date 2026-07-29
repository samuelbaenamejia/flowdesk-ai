import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationHeader } from "@/components/workspace/ConversationHeader";
import type { Conversation } from "@/types";

const activeConversation: Conversation = {
  id: "1",
  contact_id: "c1",
  contact_name: "Juan Pérez",
  status: "active",
  last_message_preview: null,
  last_message_at: null,
  created_at: "2026-07-27T10:00:00Z",
  updated_at: "2026-07-27T10:00:00Z",
};

const takeoverConversation: Conversation = {
  ...activeConversation,
  status: "human_takeover",
};

const closedConversation: Conversation = {
  ...activeConversation,
  status: "closed",
};

describe("ConversationHeader", () => {
  it("renders contact name and badge for active status", () => {
    render(
      <ConversationHeader
        conversation={activeConversation}
        onBack={vi.fn()}
        onToggleStatus={vi.fn()}
        toggling={false}
      />
    );

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText("Control")).toBeInTheDocument();
  });

  it("renders takeover state with correct badge and button text", () => {
    render(
      <ConversationHeader
        conversation={takeoverConversation}
        onBack={vi.fn()}
        onToggleStatus={vi.fn()}
        toggling={false}
      />
    );

    expect(screen.getByText("Takeover")).toBeInTheDocument();
    expect(screen.getByText("Devolver")).toBeInTheDocument();
  });

  it("does not render takeover button for closed conversation", () => {
    render(
      <ConversationHeader
        conversation={closedConversation}
        onBack={vi.fn()}
        onToggleStatus={vi.fn()}
        toggling={false}
      />
    );

    expect(screen.getByText("Cerrada")).toBeInTheDocument();
    expect(screen.queryByText("Control")).not.toBeInTheDocument();
    expect(screen.queryByText("Devolver")).not.toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const onBack = vi.fn();
    render(
      <ConversationHeader
        conversation={activeConversation}
        onBack={onBack}
        onToggleStatus={vi.fn()}
        toggling={false}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /volver a conversaciones/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleStatus when takeover button is clicked", async () => {
    const onToggleStatus = vi.fn();
    render(
      <ConversationHeader
        conversation={activeConversation}
        onBack={vi.fn()}
        onToggleStatus={onToggleStatus}
        toggling={false}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /tomar control/i }));
    expect(onToggleStatus).toHaveBeenCalledTimes(1);
  });

  it("disables takeover button when toggling", () => {
    render(
      <ConversationHeader
        conversation={activeConversation}
        onBack={vi.fn()}
        onToggleStatus={vi.fn()}
        toggling={true}
      />
    );

    expect(screen.getByText("Cambiando...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tomar control/i })).toBeDisabled();
  });

  it("has correct aria-labels", () => {
    render(
      <ConversationHeader
        conversation={activeConversation}
        onBack={vi.fn()}
        onToggleStatus={vi.fn()}
        toggling={false}
      />
    );

    expect(
      screen.getByRole("button", { name: /volver a conversaciones/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /tomar control de la conversación/i })
    ).toBeInTheDocument();
  });
});
