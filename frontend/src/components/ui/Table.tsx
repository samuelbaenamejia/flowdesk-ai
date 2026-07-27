import { type ReactNode } from "react";

interface Header {
  key: string;
  label: string;
}

interface TableProps {
  headers: Header[];
  rows: Record<string, ReactNode>[];
  onRowClick?: (rowIndex: number) => void;
  getRowKey?: (row: Record<string, ReactNode>, index: number) => string;
  className?: string;
}

export function Table({ headers, rows, onRowClick, getRowKey, className = "" }: TableProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            {headers.map((h) => (
              <th
                key={h.key}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr
              key={getRowKey ? getRowKey(row, i) : i}
              onClick={() => onRowClick?.(i)}
              onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" || e.key === " ") onRowClick(i); } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : undefined}
              className={`transition-colors duration-150 ${
                onRowClick ? "cursor-pointer hover:bg-gray-50" : ""
              }`}
            >
              {headers.map((h) => (
                <td key={h.key} className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {row[h.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
