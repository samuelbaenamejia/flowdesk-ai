import { renderHook, waitFor, act } from "@testing-library/react";
import { useConversation } from "@/hooks/useConversation";
import { getConversation, updateConversation } from "@/lib/api";
import type { Conversation } from "@/types";

vi.mock("@/lib/api", () => ({
  getConversation: vi.fn(),
  updateConversation: vi.fn(),
}));

const mockConversation: Conversation = {
  id: "1",
  contact_id: "c1",
  contact_name: "Juan Pérez",
  status: "active",
  last_message_preview: "Hola",
  last_message_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockTakeoverConversation: Conversation = {
  ...mockConversation,
  status: "human_takeover",
};

const getConversationMock = vi.mocked(getConversation);
const updateConversationMock = vi.mocked(updateConversation);

describe("useConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches conversation on mount with id", async () => {
    getConversationMock.mockResolvedValue(mockConversation);
    const { result } = renderHook(() => useConversation("1"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getConversationMock).toHaveBeenCalledWith("1", expect.any(AbortSignal));
    expect(result.current.conversation).toEqual(mockConversation);
  });

  it("does not fetch without id", () => {
    renderHook(() => useConversation(undefined));
    expect(getConversationMock).not.toHaveBeenCalled();
  });

  it("sets notFound when API returns 404", async () => {
    getConversationMock.mockRejectedValue(new Error("404"));
    const { result } = renderHook(() => useConversation("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notFound).toBe(true);
    expect(result.current.conversation).toBeNull();
  });

  it("sets error when fetch fails", async () => {
    getConversationMock.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useConversation("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network error");
  });

  it("toggleStatus changes active to human_takeover", async () => {
    getConversationMock.mockResolvedValue(mockConversation);
    updateConversationMock.mockResolvedValue(mockTakeoverConversation);
    const { result } = renderHook(() => useConversation("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleStatus();
    });

    expect(updateConversationMock).toHaveBeenCalledWith("1", "human_takeover");
    expect(result.current.conversation?.status).toBe("human_takeover");
  });

  it("toggleStatus changes human_takeover to active", async () => {
    getConversationMock.mockResolvedValue(mockTakeoverConversation);
    updateConversationMock.mockResolvedValue(mockConversation);
    const { result } = renderHook(() => useConversation("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleStatus();
    });

    expect(updateConversationMock).toHaveBeenCalledWith("1", "active");
    expect(result.current.conversation?.status).toBe("active");
  });

  it("toggleStatus does nothing if conversation is closed", async () => {
    const closedConv = { ...mockConversation, status: "closed" };
    getConversationMock.mockResolvedValue(closedConv);
    const { result } = renderHook(() => useConversation("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleStatus();
    });

    expect(updateConversationMock).not.toHaveBeenCalled();
  });

  it("sets toggling while toggleStatus is in flight", async () => {
    getConversationMock.mockResolvedValue(mockConversation);
    updateConversationMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockTakeoverConversation), 100))
    );
    const { result } = renderHook(() => useConversation("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const togglePromise = result.current.toggleStatus();

    await waitFor(() => expect(result.current.toggling).toBe(true));

    await togglePromise;
    await waitFor(() => expect(result.current.toggling).toBe(false));
  });

  it("aborts in-flight request when id changes", async () => {
    getConversationMock.mockReturnValue(new Promise(() => {}));
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useConversation(id),
      { initialProps: { id: "1" } }
    );

    expect(result.current.loading).toBe(true);

    rerender({ id: "2" });

    expect(getConversationMock).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);
  });
});
