import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function PreferencesSection() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Preferencias</h2>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Tema</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {theme === "dark" ? "Oscuro" : "Claro"}
          </p>
        </div>
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Cambiar tema"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Versión</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">v0.9.0</p>
      </div>
    </div>
  );
}
