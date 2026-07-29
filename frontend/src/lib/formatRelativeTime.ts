const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return rtf.format(-diffHours, "hour");
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return rtf.format(-diffDays, "day");
  return rtf.format(-Math.floor(diffDays / 30), "month");
}
