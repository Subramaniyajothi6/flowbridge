export function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "-";
  const milliseconds = new Date(end).getTime() - new Date(start).getTime();
  if (milliseconds < 1000) return `${milliseconds} ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)} s`;
  return `${Math.floor(milliseconds / 60_000)} min ${Math.round((milliseconds % 60_000) / 1000)} s`;
}

// Turns "send_message" into "Send message".
export function humanize(id: string): string {
  const words = id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatJson(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value, null, 2);
}
