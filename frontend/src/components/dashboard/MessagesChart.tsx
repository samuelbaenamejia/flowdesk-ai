import { useState } from "react";
import type { MessagesOverTimePoint } from "@/types";

interface MessagesChartProps {
  data: MessagesOverTimePoint[];
}

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 56;
const PADDING_TOP = 4;
const PADDING_BOTTOM = 6;

function formatShortDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(date);
}

export function MessagesChart({ data }: MessagesChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
        Sin datos de mensajes para mostrar
      </p>
    );
  }

  const maxCount = Math.max(...data.map((p) => p.count), 1);
  const chartHeight = VIEWBOX_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const xFor = (index: number) =>
    data.length === 1 ? 50 : (index / (data.length - 1)) * VIEWBOX_WIDTH;
  const yFor = (count: number) =>
    PADDING_TOP + chartHeight - (count / maxCount) * chartHeight;

  const linePoints = data.map((p, i) => `${xFor(i)},${yFor(p.count)}`).join(" ");

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const hoveredX = hoverIndex !== null ? xFor(hoverIndex) : 0;
  const hoveredY = hoverIndex !== null ? yFor(data[hoverIndex].count) : 0;

  const total = data.reduce((sum, p) => sum + p.count, 0);

  return (
    <div
      className="relative h-56 w-full"
      role="img"
      aria-label={`Mensajes de los últimos 30 días. Total: ${total} mensajes. Máximo diario: ${maxCount}.`}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            y1={PADDING_TOP + chartHeight * ratio}
            x2={VIEWBOX_WIDTH}
            y2={PADDING_TOP + chartHeight * ratio}
            className="stroke-gray-100 dark:stroke-gray-700"
            strokeWidth="1"
          />
        ))}
        <polyline
          points={linePoints}
          fill="none"
          className="stroke-blue-500 dark:stroke-blue-400"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {data.map((point, index) => (
        <div
          key={point.date}
          aria-hidden="true"
          onMouseEnter={() => setHoverIndex(index)}
          onMouseLeave={() => setHoverIndex(null)}
          className={`pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
            hoverIndex === index
              ? "bg-blue-600 ring-2 ring-blue-200 dark:bg-blue-300 dark:ring-blue-900"
              : "bg-blue-500/60 dark:bg-blue-400/60"
          }`}
          style={{ left: `${xFor(index)}%`, top: `${(yFor(point.count) / VIEWBOX_HEIGHT) * 100}%` }}
        />
      ))}

      {hovered && hoverIndex !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          style={{ left: `${hoveredX}%`, top: `${(hoveredY / VIEWBOX_HEIGHT) * 100}%` }}
        >
          {formatShortDate(hovered.date)}: {hovered.count} {hovered.count === 1 ? "mensaje" : "mensajes"}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
        <span>{formatShortDate(data[0].date)}</span>
        <span>{formatShortDate(data[Math.floor((data.length - 1) / 2)].date)}</span>
        <span>{formatShortDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
