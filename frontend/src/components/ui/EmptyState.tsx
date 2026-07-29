import { type LucideIcon } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-12 dark:border-gray-700 dark:bg-gray-800">
      <Icon className="mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" aria-hidden="true" />
      <h3 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-50">{title}</h3>
      {description && <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
