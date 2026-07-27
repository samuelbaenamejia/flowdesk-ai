import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
        <div className="min-w-0">
          {title && <p className="text-sm font-medium text-red-800">{title}</p>}
          <p className="mt-1 text-sm text-red-700">{message}</p>
          {onRetry && (
            <Button
              variant="secondary"
              onClick={onRetry}
              className="mt-3"
            >
              Reintentar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
