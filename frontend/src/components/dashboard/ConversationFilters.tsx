import { SearchBar } from "@/components/ui/SearchBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const STATUS_OPTIONS = [
  { label: "Todas", value: "" },
  { label: "Activas", value: "active" },
  { label: "Human Takeover", value: "human_takeover" },
  { label: "Cerradas", value: "closed" },
];

const CONTROL_CLASS =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50";

interface ConversationFiltersProps {
  search: string;
  statusFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onDateFromChange: (value: string | null) => void;
  onDateToChange: (value: string | null) => void;
  onClear: () => void;
}

export function ConversationFilters({
  search,
  statusFilter,
  dateFrom,
  dateTo,
  onSearchChange,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onClear,
}: ConversationFiltersProps) {
  const activeCount = [search, statusFilter, dateFrom, dateTo].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          ariaLabel="Buscar conversaciones por contacto"
          placeholder="Buscar contacto..."
          className="sm:w-64"
        />

        <div className="flex items-center gap-2">
          <label
            htmlFor="conversation-status-filter"
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            Estado:
          </label>
          <select
            id="conversation-status-filter"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className={CONTROL_CLASS}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <label
            htmlFor="conversation-date-from"
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            Desde:
          </label>
          <input
            id="conversation-date-from"
            type="date"
            value={dateFrom ?? ""}
            onChange={(e) => onDateFromChange(e.target.value || null)}
            className={CONTROL_CLASS}
          />
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="conversation-date-to"
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            Hasta:
          </label>
          <input
            id="conversation-date-to"
            type="date"
            value={dateTo ?? ""}
            onChange={(e) => onDateToChange(e.target.value || null)}
            className={CONTROL_CLASS}
          />
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span aria-label={`${activeCount} filtros activos`}>
              <Badge variant="info">
                {activeCount} {activeCount === 1 ? "activo" : "activos"}
              </Badge>
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onClear}
            disabled={activeCount === 0}
            aria-label="Limpiar filtros"
          >
            Limpiar filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
