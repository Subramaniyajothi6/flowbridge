// Run times are shown in the time zone chosen in the person's profile.
let displayTimezone: string | undefined;

export function setDisplayTimezone(timezone: string): void {
  displayTimezone = timezone;
}

export function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: displayTimezone });
}

export function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "-";
  const milliseconds = new Date(end).getTime() - new Date(start).getTime();
  if (milliseconds < 1000) return `${milliseconds} ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)} s`;
  return `${Math.floor(milliseconds / 60_000)} min ${Math.round((milliseconds % 60_000) / 1000)} s`;
}

export function formatSeconds(seconds: number): string {
  return seconds < 60 ? `${seconds.toFixed(1)} s` : `${(seconds / 60).toFixed(1)} min`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

// Shows a share of a total, or a dash when there is nothing to divide by.
export function formatPercent(part: number, total: number): string {
  return total === 0 ? "-" : `${((part / total) * 100).toFixed(1)}%`;
}

// Turns "send_message" into "Send message".
export function humanize(id: string): string {
  const words = id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatJson(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value, null, 2);
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("");
}
