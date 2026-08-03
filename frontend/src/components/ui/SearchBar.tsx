import { forwardRef, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  clearLabel?: string;
  showShortcutHint?: boolean;
  shortcutHint?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      value,
      onChange,
      ariaLabel,
      clearLabel = "Limpiar búsqueda",
      showShortcutHint = false,
      shortcutHint = "/",
      className = "",
      onKeyDown,
      ...props
    },
    ref
  ) {
    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Escape") {
        if (value) {
          onChange("");
        }
        e.currentTarget.blur();
      }
      onKeyDown?.(e);
    }

    return (
      <div className={`relative ${className}`}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          aria-hidden="true"
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          className="block w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-150 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50 dark:placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
          {...props}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={clearLabel}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : showShortcutHint ? (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-gray-300 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 md:inline dark:border-gray-600 dark:text-gray-500">
            {shortcutHint}
          </kbd>
        ) : null}
      </div>
    );
  }
);
