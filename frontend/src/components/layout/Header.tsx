import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { LogOut, Menu, Sun, Moon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGlobalSearch } from "@/hooks";
import { SearchBar } from "@/components/ui/SearchBar";
import {
  SearchResultsDropdown,
  flattenSearchItems,
  type SearchItem,
} from "./SearchResultsDropdown";
import { Button } from "@/components/ui/Button";
import type { SearchMessageResult } from "@/types";

const DROPDOWN_ID = "global-search-results";

interface HeaderProps {
  title?: string;
  onToggleSidebar?: () => void;
}

export default function Header({ title = "Dashboard", onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();
  const { results, loading, query, setQuery, clear } = useGlobalSearch();

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = flattenSearchItems(results);
  const activeItem = items[activeIndex];

  function closeSearch() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleSelectConversation(id: string) {
    router.push(`/conversations/${id}`);
    clear();
    closeSearch();
  }

  function handleSelectMessage(message: SearchMessageResult) {
    router.push(`/conversations/${message.conversation_id}?msg=${message.id}`);
    clear();
    closeSearch();
  }

  function handleViewAll() {
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    clear();
    closeSearch();
  }

  function openItem(item: SearchItem) {
    if (item.kind === "conversation") {
      handleSelectConversation(item.conversation.id);
    } else {
      handleSelectMessage(item.message);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      closeSearch();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) =>
        items.length === 0 ? -1 : prev < items.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) =>
        items.length === 0 ? -1 : prev > 0 ? prev - 1 : items.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeItem) {
        openItem(activeItem);
      } else {
        handleViewAll();
      }
    }
  }

  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query) closeSearch();
  }, [query]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [items.length]);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const showDropdown = Boolean(open && query.trim());

  return (
    <header className="relative border-b border-gray-200 bg-white px-4 py-3 md:px-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="-ml-2 rounded-md p-2 transition-colors hover:bg-gray-100 lg:hidden dark:hover:bg-gray-700"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <span className="truncate text-sm text-gray-500 dark:text-gray-400">{title}</span>
        </div>

        <div ref={containerRef} className="relative w-full max-w-md min-w-0 flex-1">
          <SearchBar
            ref={inputRef}
            value={query}
            onChange={setQuery}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            ariaLabel="Buscar en el inbox"
            placeholder="Buscar en el inbox..."
            showShortcutHint
            aria-expanded={showDropdown}
            aria-controls={DROPDOWN_ID}
            aria-activedescendant={
              showDropdown && activeItem ? `global-search-option-${activeIndex}` : undefined
            }
          />
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2" aria-live="polite">
              <SearchResultsDropdown
                query={query}
                results={results}
                loading={loading}
                activeIndex={activeIndex}
                onSelectConversation={handleSelectConversation}
                onSelectMessage={handleSelectMessage}
                onViewAll={handleViewAll}
                onMouseEnterOption={setActiveIndex}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 max-md:hidden">
          <button
            onClick={toggleTheme}
            className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label={
              mounted && theme === "dark"
                ? "Cambiar a modo claro"
                : "Cambiar a modo oscuro"
            }
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          {user?.email ? (
            <span className="text-sm text-gray-400 dark:text-gray-500">{user.email}</span>
          ) : null}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
