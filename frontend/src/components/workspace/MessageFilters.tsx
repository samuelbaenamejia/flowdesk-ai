import { SearchBar } from "@/components/ui/SearchBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const DIRECTION_OPTIONS = [
  { label: "Todas", value: "" },
  { label: "Entrantes", value: "incoming" },
  { label: "Salientes", value: "outgoing" },
];

const STATUS_OPTIONS = [
  { label: "Todos", value: "" },
  { label: "Enviados", value: "sent" },
  { label: "Entregados", value: "delivered" },
  { label: "Leídos", value: "read" },
  { label: "Fallidos", value: "failed" },
];

const CONTROL_CLASS =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50";

interface MessageFiltersProps {
  search: string;
  directionFilter: string;
  statusFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
  onSearchChange: (value: string) => void;
  onDirectionChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onDateFromChange: (value: string | null) => void;
  onDateToChange: (value: string | null) => void;
  onClear: () => void;
}

export function MessageFilters({
  search,
  directionFilter,
  statusFilter,
  dateFrom,
  dateTo,
  onSearchChange,
  onDirectionChange,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onClear,
}: MessageFiltersProps) {
  const activeCount = [search, directionFilter, statusFilter, dateFrom, dateTo].filter(
    Boolean
  ).length;

  return (
    <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:flex-row lg:items-center dark:border-gray-700 dark:bg-gray-800">
      <SearchBar
        value={search}
        onChange={onSearchChange}
        ariaLabel="Buscar en mensajes"
        placeholder="Buscar en mensajes..."
        className="lg:flex-1 lg:max-w-sm"
      />

      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="message-direction-filter"
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            Dirección:
          </label>
          <select
            id="message-direction-filter"
            value={directionFilter}
            onChange={(e) => onDirectionChange(e.target.value)}
            className={CONTROL_CLASS}
          >
            {DIRECTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="message-status-filter"
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            Estado:
          </label>
          <select
            id="message-status-filter"
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

        <div className="flex items-center gap-2">
          <label
            htmlFor="message-date-from"
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            Desde:
          </label>
          <input
            id="message-date-from"
            type="date"
            value={dateFrom ?? ""}
            onChange={(e) => onDateFromChange(e.target.value || null)}
            className={CONTROL_CLASS}
          />
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="message-date-to"
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            Hasta:
          </label>
          <input
            id="message-date-to"
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
