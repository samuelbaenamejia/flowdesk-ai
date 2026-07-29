import { renderHook, waitFor, act } from "@testing-library/react";
import { useMessages } from "@/hooks/useMessages";
import { getConversationMessages, sendMessage as apiSendMessage } from "@/lib/api";
import type { Message } from "@/types";

vi.mock("@/lib/api", () => ({
  getConversationMessages: vi.fn(),
  sendMessage: vi.fn(),
}));

const mockMessage: Message = {
  id: "m1",
  conversation_id: "1",
  direction: "incoming",
  content_type: "text",
  content: "Hola",
  wa_message_id: null,
  status: "sent",
  created_at: new Date().toISOString(),
};

const LIMIT = 50;

const getMessagesMock = vi.mocked(getConversationMessages);
const sendMessageMock = vi.mocked(apiSendMessage);

describe("useMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches messages on mount with conversationId", async () => {
    getMessagesMock.mockResolvedValue([mockMessage]);
    const { result } = renderHook(() => useMessages("1"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getMessagesMock).toHaveBeenCalledWith(
      "1",
      { limit: LIMIT, offset: 0 },
      expect.any(AbortSignal)
    );
    expect(result.current.messages).toEqual([mockMessage]);
  });

  it("does not fetch without conversationId", () => {
    renderHook(() => useMessages(undefined));
    expect(getMessagesMock).not.toHaveBeenCalled();
  });

  it("loadMore increments offset and fetches again", async () => {
    getMessagesMock.mockResolvedValue([mockMessage]);
    const { result } = renderHook(() => useMessages("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    getMessagesMock.mockResolvedValue([{ ...mockMessage, id: "m2" }]);

    act(() => {
      result.current.loadMore();
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getMessagesMock).toHaveBeenLastCalledWith(
      "1",
      { limit: LIMIT, offset: LIMIT },
      expect.any(AbortSignal)
    );
  });

  it("sets hasMore when data.length >= LIMIT", async () => {
    const manyMessages = Array.from({ length: LIMIT }, (_, i) => ({
      ...mockMessage,
      id: `m${i}`,
    }));
    getMessagesMock.mockResolvedValue(manyMessages);
    const { result } = renderHook(() => useMessages("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasMore).toBe(true);
  });

  it("sets hasMore to false when data.length < LIMIT", async () => {
    getMessagesMock.mockResolvedValue([mockMessage]);
    const { result } = renderHook(() => useMessages("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasMore).toBe(false);
  });

  it("sendMessage appends new message to list", async () => {
    getMessagesMock.mockResolvedValue([mockMessage]);
    const { result } = renderHook(() => useMessages("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const newMessage: Message = {
      ...mockMessage,
      id: "m2",
      content: "Respuesta",
      direction: "outgoing",
    };
    sendMessageMock.mockResolvedValue(newMessage);

    await act(async () => {
      await result.current.sendMessage("Respuesta");
    });

    expect(sendMessageMock).toHaveBeenCalledWith("1", "Respuesta");
    expect(result.current.messages).toEqual([mockMessage, newMessage]);
  });

  it("sendMessage sets sendError on failure", async () => {
    getMessagesMock.mockResolvedValue([mockMessage]);
    const { result } = renderHook(() => useMessages("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    sendMessageMock.mockRejectedValue(new Error("Error de envío"));

    await act(async () => {
      await result.current.sendMessage("Hola").catch(() => {});
    });

    expect(result.current.sendError).toBe("Error de envío");
  });

  it("sendMessage does not call API with empty content", async () => {
    getMessagesMock.mockResolvedValue([mockMessage]);
    const { result } = renderHook(() => useMessages("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("sets error when fetch fails", async () => {
    getMessagesMock.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useMessages("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network error");
  });

  it("prepends messages on loadMore", async () => {
    const initialMessages = [mockMessage];
    getMessagesMock.mockResolvedValue(initialMessages);
    const { result } = renderHook(() => useMessages("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const olderMessages = [
      { ...mockMessage, id: "m0", content: "Antiguo" },
    ];
    getMessagesMock.mockResolvedValue(olderMessages);

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.messages).toEqual([...olderMessages, ...initialMessages]);
  });

  it("aborts in-flight request on unmount", async () => {
    getMessagesMock.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderHook(() => useMessages("1"));

    const firstSignal = getMessagesMock.mock.calls[0][2] as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    unmount();

    expect(firstSignal.aborted).toBe(true);
  });
});
