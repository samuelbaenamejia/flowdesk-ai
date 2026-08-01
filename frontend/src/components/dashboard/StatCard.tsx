import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
}

export function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
        </div>
        {Icon && (
          <span className="shrink-0 rounded-lg bg-gray-100 p-2 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
