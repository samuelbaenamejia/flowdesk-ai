import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Users } from "lucide-react";

const navItems = [
  { label: "Conversaciones", href: "/conversations", icon: MessageSquare },
  { label: "Contactos", href: "/contacts", icon: Users },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const { user } = useAuth();

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:relative lg:w-16 lg:transform-none lg:z-auto dark:bg-gray-800 dark:border-gray-700 ${
        !isOpen ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
      }`}
      onKeyDown={handleKeyDown}
    >
      <div className="flex h-14 items-center justify-center border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm font-bold text-gray-900 dark:text-gray-50">F</span>
      </div>
      <nav className="px-2 py-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  onClick={onClose}
                  className={`flex items-center rounded-lg px-2 py-2 transition-colors lg:justify-center ${
                    isActive
                      ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-50"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-50"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="ml-3 text-sm lg:hidden">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {user?.email && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-4 lg:hidden dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">{user.email}</span>
        </div>
      )}
    </aside>
  );
}
