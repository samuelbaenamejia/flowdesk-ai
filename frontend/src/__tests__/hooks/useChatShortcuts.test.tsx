import { render, screen } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react";
import { useChatShortcuts } from "@/hooks/useChatShortcuts";

function fireKeyDown(key: string, opts: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts });
  window.dispatchEvent(event);
  return event;
}

function Harness({ searchActive }: { searchActive: boolean }) {
  const { searchInputRef } = useChatShortcuts(searchActive);
  return <input ref={searchInputRef} aria-label="Buscar en mensajes" />;
}

describe("useChatShortcuts", () => {
  it("opens search and prevents default on Ctrl+F", () => {
    const { result } = renderHook(() => useChatShortcuts(false));
    let event: KeyboardEvent | null = null;
    act(() => {
      event = fireKeyDown("f", { ctrlKey: true });
    });
    expect(event!.defaultPrevented).toBe(true);
    expect(result.current.searchOpen).toBe(true);
  });

  it("opens search on Cmd+F", () => {
    const { result } = renderHook(() => useChatShortcuts(false));
    act(() => {
      fireKeyDown("f", { metaKey: true });
    });
    expect(result.current.searchOpen).toBe(true);
  });

  it("focuses the search input when Ctrl+F is pressed", async () => {
    render(<Harness searchActive={false} />);
    act(() => {
      fireKeyDown("f", { ctrlKey: true });
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(screen.getByLabelText("Buscar en mensajes")).toHaveFocus();
  });

  it("closes search on Escape when search is active", () => {
    const { result } = renderHook(() => useChatShortcuts(true));
    act(() => result.current.setSearchOpen(true));
    act(() => {
      fireKeyDown("Escape");
    });
    expect(result.current.searchOpen).toBe(false);
  });

  it("does not close on Escape when search is not active", () => {
    const { result } = renderHook(() => useChatShortcuts(false));
    act(() => result.current.setSearchOpen(true));
    act(() => {
      fireKeyDown("Escape");
    });
    expect(result.current.searchOpen).toBe(true);
  });

  it("removes event listeners on unmount", () => {
    const { result, unmount } = renderHook(() => useChatShortcuts(false));
    unmount();
    const event = fireKeyDown("f", { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(result.current.searchOpen).toBe(false);
  });
});
