import Link from "next/link";
import { useRouter } from "next/router";
import { MessageSquare } from "lucide-react";

const navItems = [
  { label: "Conversaciones", href: "/conversations", icon: MessageSquare },
];

export default function Sidebar() {
  const router = useRouter();

  return (
    <aside className="w-16 border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center justify-center border-b border-gray-200">
        <span className="text-sm font-bold text-gray-900">F</span>
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
                  className={`flex items-center justify-center rounded-lg px-2 py-2 transition-colors ${
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
