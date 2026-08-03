import { type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const DAY_MS = 86_400_000;

export function getDateGroupKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortWeekday(date: Date): string {
  return date.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
}

function shortMonth(date: Date): string {
  return date.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
}

export function formatDateGroupLabel(dateKey: string, now: Date = new Date()): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - date.getTime()) / DAY_MS);

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";

  const mondayOffset = (today.getDay() + 6) % 7;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - mondayOffset);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  if (date >= startOfWeek && date <= endOfWeek) {
    return `${shortWeekday(date)} ${date.getDate()} ${shortMonth(date)}`;
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getDate()} ${shortMonth(date)}`;
  }
  return `${date.getDate()} ${shortMonth(date)} ${date.getFullYear()}`;
}

interface DateGroupProps {
  dateKey: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function DateGroup({ dateKey, count, collapsed, onToggle, children }: DateGroupProps) {
  const label = formatDateGroupLabel(dateKey);

  return (
    <div className="space-y-2">
      <div className="sticky top-0 z-10 -mx-6 bg-white px-6 dark:bg-gray-800">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-1 rounded-md py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{label}</span>
          {collapsed && (
            <span className="normal-case tracking-normal">
              · {count} {count === 1 ? "mensaje" : "mensajes"}
            </span>
          )}
        </button>
      </div>
      {!collapsed && <div className="space-y-4">{children}</div>}
    </div>
  );
}
