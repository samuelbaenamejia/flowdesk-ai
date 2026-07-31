import { renderHook, waitFor, act } from "@testing-library/react";
import { useConversations } from "@/hooks/useConversations";
import { getConversations } from "@/lib/api";
import type { Conversation, ConversationListResponse } from "@/types";

vi.mock("@/lib/api", () => ({
  getConversations: vi.fn(),
}));

const mockConversation: Conversation = {
  id: "1",
  contact_id: "c1",
  contact_name: "Juan",
  status: "active",
  last_message_preview: "Hola",
  last_message_at: new Date().toISOString(),
  created_at: "",
  updated_at: "",
};

function paginated(
  items: Conversation[],
  total = items.length
): ConversationListResponse {
  return { items, total, limit: 20, offset: 0 };
}

const getConversationsMock = vi.mocked(getConversations);

describe("useConversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches conversations on mount", async () => {
    getConversationsMock.mockResolvedValue(paginated([mockConversation]));
    const { result } = renderHook(() => useConversations());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getConversationsMock).toHaveBeenCalledWith(
      { limit: 20, offset: 0 },
      expect.any(AbortSignal)
    );
    expect(result.current.conversations).toEqual([mockConversation]);
    expect(result.current.total).toBe(1);
  });

  it("resets offset and refetches on filter change", async () => {
    getConversationsMock.mockResolvedValue(paginated([mockConversation]));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    getConversationsMock.mockResolvedValue(paginated([]));

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
    getConversationsMock.mockResolvedValue(paginated([mockConversation]));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleNext();
    });

    expect(result.current.offset).toBe(20);
  });

  it("decrements offset on handlePrevious", async () => {
    getConversationsMock.mockResolvedValue(paginated([mockConversation]));
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
    getConversationsMock.mockResolvedValue(paginated([mockConversation]));
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

    getConversationsMock.mockResolvedValue(paginated([mockConversation]));

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.conversations).toEqual([mockConversation]);
  });

  it("handles empty data", async () => {
    getConversationsMock.mockResolvedValue(paginated([], 0));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.conversations).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.hasMore).toBe(false);
  });

  it("sets hasMore based on total", async () => {
    const twentyItems = Array.from({ length: 20 }, (_, i) => ({
      ...mockConversation,
      id: String(i + 1),
    }));
    getConversationsMock.mockResolvedValue(paginated(twentyItems, 35));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasMore).toBe(true);
  });

  it("sets hasMore to false when offset + items >= total", async () => {
    const twentyItems = Array.from({ length: 20 }, (_, i) => ({
      ...mockConversation,
      id: String(i + 1),
    }));
    getConversationsMock.mockResolvedValue(paginated(twentyItems, 20));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasMore).toBe(false);
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
    getConversationsMock.mockResolvedValue(paginated([mockConversation]));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getConversationsMock).toHaveBeenCalledTimes(1);

    getConversationsMock.mockClear();
    getConversationsMock.mockResolvedValue(paginated([mockConversation]));

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(getConversationsMock).toHaveBeenCalledTimes(1);
      expect(getConversationsMock).toHaveBeenCalledWith(
        { limit: 20, offset: 0 },
        expect.any(AbortSignal)
      );
    });
  });

  it("does not poll when filters are active", async () => {
    getConversationsMock.mockResolvedValue(paginated([mockConversation]));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    getConversationsMock.mockClear();
    act(() => {
      result.current.setStatusFilter("closed");
    });
    await waitFor(() => expect(getConversationsMock).toHaveBeenCalledTimes(1));

    getConversationsMock.mockClear();
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(getConversationsMock).not.toHaveBeenCalled();
  });

  it("debounces search and sends q param", async () => {
    getConversationsMock.mockResolvedValue(paginated([]));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    getConversationsMock.mockClear();

    act(() => {
      result.current.setSearch("juan");
    });
    expect(getConversationsMock).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(getConversationsMock).toHaveBeenCalledWith(
          { q: "juan", limit: 20, offset: 0 },
          expect.any(AbortSignal)
        );
      },
      { timeout: 1000 }
    );
  });

  it("sends date filters as query params", async () => {
    getConversationsMock.mockResolvedValue(paginated([mockConversation]));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    getConversationsMock.mockClear();

    act(() => {
      result.current.setDateFrom("2026-01-01");
      result.current.setDateTo("2026-06-30");
    });

    await waitFor(() => {
      expect(getConversationsMock).toHaveBeenCalledWith(
        {
          date_from: "2026-01-01",
          date_to: "2026-06-30",
          limit: 20,
          offset: 0,
        },
        expect.any(AbortSignal)
      );
    });
  });

  it("exposes filters object with current state", async () => {
    getConversationsMock.mockResolvedValue(paginated([mockConversation]));
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setStatusFilter("closed");
    });

    expect(result.current.filters).toEqual({
      q: "",
      status: "closed",
      date_from: null,
      date_to: null,
    });
  });
});
