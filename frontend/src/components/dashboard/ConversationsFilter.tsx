const OPTIONS = [
  { label: "Todas", value: "" },
  { label: "Activas", value: "active" },
  { label: "Human Takeover", value: "human_takeover" },
  { label: "Cerradas", value: "closed" },
];

interface ConversationsFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function ConversationsFilter({ value, onChange }: ConversationsFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="status-filter" className="text-sm text-gray-600 dark:text-gray-400">
        Filtrar:
      </label>
      <select
        id="status-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full md:w-auto rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
