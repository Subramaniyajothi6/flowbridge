import type { Role } from "../db/schema.ts";

// Works out the "Needs an Administrator" list on Overview from plain facts,
// so it can be tested without a database.

const DAY_MS = 86400 * 1000;
// Matches "Expiring soon" on the Integrations page.
const EXPIRING_SOON_MS = 2 * DAY_MS;
// The share of the monthly run limit at which an Administrator is warned.
const USAGE_WARNING_SHARE = 0.8;

export const ROLE_NAMES: Record<Role, string> = {
  administrator: "Administrator",
  workflow_builder: "Workflow Builder",
  business_user: "Business User",
};

export type AdminTask = {
  kind: "connection" | "limit" | "member" | "usage";
  title: string;
  detail: string;
  action: string;
  href: string;
};

export type ConnectionFacts = { appName: string; account: string | null; status: "active" | "needs_reconnect"; expiresAt: Date | null; workflowCount: number };
export type MemberFacts = { name: string; role: Role; createdAt: Date; lastSignInAt: Date | null };
export type LimitFacts = { appName: string; failures: number };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function usedBy(connection: ConnectionFacts): string {
  const account = connection.account ? `${connection.account}. ` : "";
  if (connection.workflowCount === 0) return `${account}No workflow uses it yet.`;
  return `${account}${plural(connection.workflowCount, "workflow uses", "workflows use")} this connection.`;
}

function daysAgo(then: Date, now: Date): string {
  const days = Math.floor((now.getTime() - then.getTime()) / DAY_MS);
  if (days <= 0) return "today";
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function needsUsage(used: number, limit: number): boolean {
  return limit > 0 && used / limit >= USAGE_WARNING_SHARE;
}

export function isExpiringSoon(connection: ConnectionFacts, now: Date): boolean {
  return connection.status === "active" && connection.expiresAt !== null && connection.expiresAt.getTime() - now.getTime() < EXPIRING_SOON_MS;
}

export function adminTasks(facts: { connections: ConnectionFacts[]; members: MemberFacts[]; limitHits: LimitFacts[]; used: number; limit: number; now: Date }): AdminTask[] {
  const { now } = facts;
  const tasks: AdminTask[] = [];

  for (const connection of facts.connections) {
    if (connection.status === "needs_reconnect") {
      tasks.push({ kind: "connection", title: `The ${connection.appName} connection needs connecting again`, detail: usedBy(connection), action: "Review", href: "/integrations" });
    } else if (isExpiringSoon(connection, now)) {
      const msLeft = (connection.expiresAt as Date).getTime() - now.getTime();
      const when = msLeft <= 0 ? "has expired" : msLeft < DAY_MS ? "expires within a day" : "expires in 2 days";
      tasks.push({ kind: "connection", title: `The ${connection.appName} connection ${when}`, detail: usedBy(connection), action: "Review", href: "/integrations" });
    }
  }

  for (const hit of facts.limitHits) {
    tasks.push({ kind: "limit", title: `${hit.appName} reached a sending or usage limit`, detail: `${plural(hit.failures, "step", "steps")} failed for this in the last 24 hours.`, action: "Review", href: "/analytics" });
  }

  if (needsUsage(facts.used, facts.limit)) {
    const share = Math.floor((facts.used / facts.limit) * 100);
    tasks.push({ kind: "usage", title: `${share}% of this month's live runs are used`, detail: `${facts.used.toLocaleString("en-US")} of ${facts.limit.toLocaleString("en-US")}. New live runs are refused at the limit.`, action: "Review", href: "/settings" });
  }

  for (const member of facts.members) {
    if (member.lastSignInAt) continue;
    tasks.push({ kind: "member", title: `${member.name} has not signed in yet`, detail: `Added ${daysAgo(member.createdAt, now)} as a ${ROLE_NAMES[member.role]}.`, action: "Open team", href: "/team" });
  }

  return tasks;
}
