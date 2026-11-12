// Run times are shown in the time zone chosen in the person's profile.
let displayTimezone: string | undefined;

export function setDisplayTimezone(timezone: string): void {
  displayTimezone = timezone;
}

export function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: displayTimezone });
}

// Recent times read the way people say them: "Just now", "5 min ago", "Today, 09:00", "Yesterday, 17:52".
// Anything older falls back to the full date.
// With "exact", recent times keep their seconds instead of "5 min ago": "Today, 10:43:02".
export function formatRelative(value: string, { exact = false } = {}): string {
  const then = new Date(value);
  const minutesAgo = Math.floor((Date.now() - then.getTime()) / 60_000);
  if (!exact && minutesAgo < 1) return "Just now";
  if (!exact && minutesAgo < 60) return `${minutesAgo} min ago`;

  const dayOf = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: displayTimezone });
  const time = then.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: exact ? "2-digit" : undefined, timeZone: displayTimezone });
  if (dayOf(then) === dayOf(new Date())) return `Today, ${time}`;
  if (dayOf(then) === dayOf(new Date(Date.now() - 86_400_000))) return `Yesterday, ${time}`;
  return formatDate(value);
}

// "10:42", in the person's own time zone.
export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone: displayTimezone });
}

// "Tuesday, 10 November 2026".
export function formatDay(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: displayTimezone });
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
