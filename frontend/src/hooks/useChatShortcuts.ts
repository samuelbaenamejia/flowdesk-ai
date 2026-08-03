import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

interface UseChatShortcutsReturn {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  searchInputRef: RefObject<HTMLInputElement>;
}

export function useChatShortcuts(searchActive: boolean): UseChatShortcutsReturn {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchActiveRef = useRef(searchActive);

  useEffect(() => {
    searchActiveRef.current = searchActive;
  }, [searchActive]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    requestAnimationFrame(() => {
      searchInputRef.current?.blur();
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.key === "Escape" && searchActiveRef.current) {
        event.preventDefault();
        closeSearch();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openSearch, closeSearch]);

  return { searchOpen, setSearchOpen, searchInputRef };
}
