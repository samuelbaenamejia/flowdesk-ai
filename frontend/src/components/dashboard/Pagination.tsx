import { Button } from "@/components/ui/Button";

interface PaginationProps {
  offset: number;
  limit: number;
  hasMore: boolean;
  loading: boolean;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function Pagination({
  offset,
  limit,
  hasMore,
  loading,
  count,
  onPrevious,
  onNext,
}: PaginationProps) {
  const from = count > 0 ? offset + 1 : 0;
  const to = offset + count;

  return (
    <div className="flex items-center justify-between">
      <Button
        variant="secondary"
        size="sm"
        disabled={offset === 0 || loading}
        onClick={onPrevious}
        aria-label="Página anterior"
      >
        Anterior
      </Button>
      <span className="hidden md:inline text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
        {from} – {to}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={!hasMore || loading}
        onClick={onNext}
        aria-label="Página siguiente"
      >
        Siguiente
      </Button>
    </div>
  );
}
