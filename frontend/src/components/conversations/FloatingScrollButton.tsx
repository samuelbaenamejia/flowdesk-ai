import { ArrowDown } from "lucide-react";

interface FloatingScrollButtonProps {
  visible: boolean;
  count: number;
  onClick: () => void;
}

export function FloatingScrollButton({ visible, count, onClick }: FloatingScrollButtonProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ir al final y ver mensajes nuevos"
      className="absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-700 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800"
    >
      <ArrowDown className="h-5 w-5" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
