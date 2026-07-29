import { renderHook, waitFor, act } from "@testing-library/react";
import { useConversations } from "@/hooks/useConversations";
import { getConversations } from "@/lib/api";
import type { Conversation } from "@/types";

vi.mock("@/lib/api", () => ({
  getConversations: vi.fn(),
}));

const mockConversations: Conversation[] = [
  {
    id: "1",
    contact_id: "c1",
    contact_name: "Juan",
    status: "active",
    last_message_preview: "Hola",
    last_message_at: new Date().toISOString(),
    created_at: "",
    updated_at: "",
  },
];

const getConversationsMock = vi.mocked(getConversations);

describe("useConversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches conversations on mount", async () => {
    getConversationsMock.mockResolvedValue(mockConversations);
    const { result } = renderHook(() => useConversations());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getConversationsMock).toHaveBeenCalledWith(
      { status: undefined, limit: 20, offset: 0 },
      expect.any(AbortSignal)
    );
    expect(result.current.conversations).toEqual(mockConversations);
  });

  it("resets offset and refetches on filter change", async () => {
    getConversationsMock.mockResolvedValue(mockConversations);
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    getConversationsMock.mockResolvedValue([]);

    act(() => {
      result.current.setStatusFilter("closed");
    });

    expect(result.current.offset).toBe(0);
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(getConversationsMock).toHaveBeenCalledWith(
        { status: "closed", limit: 20, offset: 0 },
        expect.any(AbortSignal)
      );
    });
  });

  it("increments offset on handleNext", async () => {
    getConversationsMock.mockResolvedValue(mockConversations);
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleNext();
    });

    expect(result.current.offset).toBe(20);
  });

  it("decrements offset on handlePrevious", async () => {
    getConversationsMock.mockResolvedValue(mockConversations);
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleNext();
    });
    act(() => {
      result.current.handlePrevious();
    });

    expect(result.current.offset).toBe(0);
  });

  it("does not go below 0 on handlePrevious", async () => {
    getConversationsMock.mockResolvedValue(mockConversations);
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handlePrevious();
    });

    expect(result.current.offset).toBe(0);
  });

  it("sets error when fetch fails", async () => {
    getConversationsMock.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network error");
  });

  it("retries fetch on retry", async () => {
    getConversationsMock.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Network error");

    getConversationsMock.mockResolvedValue(mockConversations);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.conversations).toEqual(mockConversations);
  });

  it("handles empty data", async () => {
    getConversationsMock.mockResolvedValue([]);
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.conversations).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it("sets hasMore when data length equals limit", async () => {
    const twentyItems = Array.from({ length: 20 }, (_, i) => ({
      ...mockConversations[0],
      id: String(i + 1),
    }));
    getConversationsMock.mockResolvedValue(twentyItems);
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasMore).toBe(true);
  });

  it("aborts in-flight request when filter changes", async () => {
    getConversationsMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useConversations());

    expect(result.current.loading).toBe(true);

    const firstSignal = getConversationsMock.mock.calls[0][1] as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    act(() => {
      result.current.setStatusFilter("closed");
    });

    expect(firstSignal.aborted).toBe(true);
  });

  it("refetches when page becomes visible", async () => {
    getConversationsMock.mockResolvedValue(mockConversations);
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getConversationsMock).toHaveBeenCalledTimes(1);

    getConversationsMock.mockClear();
    getConversationsMock.mockResolvedValue(mockConversations);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(getConversationsMock).toHaveBeenCalledTimes(1);
      expect(getConversationsMock).toHaveBeenCalledWith(
        { status: undefined, limit: 20, offset: 0 },
        expect.any(AbortSignal)
      );
    });
  });
});
