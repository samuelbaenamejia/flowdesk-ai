import { renderHook, waitFor, act } from "@testing-library/react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { globalSearch } from "@/lib/api";
import type { GlobalSearchResponse } from "@/types";

vi.mock("@/lib/api", () => ({
  globalSearch: vi.fn(),
}));

const mockResults: GlobalSearchResponse = {
  conversations: { items: [], total: 0 },
  messages: {
    items: [
      {
        id: "m1",
        conversation_id: "c1",
        contact_name: "Juan",
        content: "¿qué día llega el pedido?",
        direction: "incoming",
        created_at: new Date().toISOString(),
        highlight: "...¿qué día llega el pedido?",
      },
    ],
    total: 1,
  },
};

const globalSearchMock = vi.mocked(globalSearch);

describe("useGlobalSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts empty with no query", () => {
    const { result } = renderHook(() => useGlobalSearch());

    expect(result.current.results).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("debounces query and fetches results", async () => {
    globalSearchMock.mockResolvedValue(mockResults);
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setQuery("pedido");
    });
    expect(globalSearchMock).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(globalSearchMock).toHaveBeenCalledWith(
          { q: "pedido" },
          expect.any(AbortSignal)
        );
      },
      { timeout: 1000 }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results?.messages.total).toBe(1);
  });

  it("does not fetch when query is cleared", async () => {
    globalSearchMock.mockResolvedValue(mockResults);
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setQuery("pedido");
    });
    await waitFor(() => expect(globalSearchMock).toHaveBeenCalled());

    act(() => {
      result.current.clear();
    });

    expect(globalSearchMock).toHaveBeenCalledTimes(1);
    expect(result.current.results).toBeNull();
    expect(result.current.query).toBe("");
  });

  it("sets error when fetch fails", async () => {
    globalSearchMock.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setQuery("pedido");
    });

    await waitFor(() => expect(result.current.error).toBe("Network error"));
  });

  it("serves cached results without refetch", async () => {
    globalSearchMock.mockResolvedValue(mockResults);
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setQuery("pedido");
    });
    await waitFor(() => expect(globalSearchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.clear();
    });
    act(() => {
      result.current.setQuery("pedido");
    });

    await waitFor(() => expect(result.current.query).toBe("pedido"));
    expect(globalSearchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.results?.messages.total).toBe(1));
  });

  it("retry refetches after error", async () => {
    globalSearchMock.mockRejectedValueOnce(new Error("Network error"));
    globalSearchMock.mockResolvedValueOnce(mockResults);
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setQuery("pedido");
    });
    await waitFor(() => expect(result.current.error).toBe("Network error"));

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.results?.messages.total).toBe(1);
  });

  it("aborts in-flight request on clear", async () => {
    globalSearchMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setQuery("pedido");
    });
    await waitFor(() => expect(globalSearchMock).toHaveBeenCalled());

    const firstSignal = globalSearchMock.mock.calls[0][1] as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    act(() => {
      result.current.clear();
    });

    expect(firstSignal.aborted).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it("aborts previous request when a new query arrives", async () => {
    globalSearchMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setQuery("pedido");
    });
    await waitFor(() => expect(globalSearchMock).toHaveBeenCalledTimes(1));
    const firstSignal = globalSearchMock.mock.calls[0][1] as AbortSignal;

    globalSearchMock.mockResolvedValue(mockResults);
    act(() => {
      result.current.setQuery("envío");
    });

    await waitFor(() => {
      expect(globalSearchMock).toHaveBeenCalledTimes(2);
    });
    expect(firstSignal.aborted).toBe(true);
  });
});
