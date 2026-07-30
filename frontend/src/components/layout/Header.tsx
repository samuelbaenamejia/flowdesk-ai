import { useRouter } from "next/router";
import { LogOut, Menu, Sun, Moon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  title?: string;
  onToggleSidebar?: () => void;
}

export default function Header({ title = "Dashboard", onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
        </div>
        <div className="flex items-center gap-4 max-md:hidden">
          <button
            onClick={toggleTheme}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label={mounted && theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
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
