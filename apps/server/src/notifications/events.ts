import type { Permission } from "../auth/permissions.ts";
import type { NotificationEvent } from "../db/schema.ts";

// The things a person can be told about, in the order the Settings page lists them.
// "who" is the permission a person needs for the row to apply to them at all.
export const NOTIFICATION_EVENTS: { event: NotificationEvent; label: string; description: string; who: Permission; email: boolean; inApp: boolean }[] = [
  { event: "fail", label: "A workflow you own fails", description: "Sent once all retries are used. Test runs never send it.", who: "workflows.edit", email: true, inApp: true },
  { event: "digest", label: "Daily failure summary", description: "Every failed live run from the past day, at 09:00 in your time zone.", who: "runs.view", email: true, inApp: false },
  { event: "token", label: "A credential is about to expire", description: "Sent 3 days and 1 day before a connection stops working, and when it needs connecting again.", who: "integrations.view", email: true, inApp: true },
  { event: "review", label: "Someone changes your workflow", description: "When another person edits, publishes or deletes it.", who: "workflows.edit", email: false, inApp: true },
  { event: "invite", label: "A new member joins", description: "Administrators only.", who: "members.manage", email: false, inApp: false },
];

export type Preference = { email: boolean; inApp: boolean };

export function defaultPreference(event: NotificationEvent): Preference {
  const found = NOTIFICATION_EVENTS.find((item) => item.event === event);
  return { email: found?.email ?? false, inApp: found?.inApp ?? false };
}

// Addresses on these reserved endings can never receive mail, such as the demo accounts.
const UNDELIVERABLE = [".example", ".test", ".invalid", ".localhost", "@example.com", "@example.org", "@example.net"];

export function canReceiveEmail(address: string): boolean {
  const lower = address.toLowerCase();
  return !UNDELIVERABLE.some((ending) => lower.endsWith(ending));
}

// The hour and date where the person is, so the summary arrives at their 09:00.
export function localTime(now: Date, timezone: string): { hour: number; date: string } {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: timezone }).format(now));
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  return { hour, date };
}

export const SUMMARY_HOUR = 9;
