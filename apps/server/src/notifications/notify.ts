import { and, eq, inArray } from "drizzle-orm";
import { hasPermission } from "../auth/permissions.ts";
import { db } from "../db/client.ts";
import { notificationPreferences, notifications, users, type NotificationEvent } from "../db/schema.ts";
import { defaultPreference, NOTIFICATION_EVENTS } from "./events.ts";

export type Message = { title: string; detail?: string; href: string };

// Records a notification for each person, following what they chose in Settings.
// Someone with both switches off gets nothing. The key makes calling this twice harmless.
export async function notify(userIds: string[], event: NotificationEvent, message: Message, key: string): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;

  const saved = await db
    .select()
    .from(notificationPreferences)
    .where(and(inArray(notificationPreferences.userId, unique), eq(notificationPreferences.event, event)));

  const rows = unique
    .map((userId) => {
      const choice = saved.find((row) => row.userId === userId) ?? defaultPreference(event);
      return { userId, choice };
    })
    .filter(({ choice }) => choice.email || choice.inApp)
    .map(({ userId, choice }) => ({
      userId,
      event,
      title: message.title,
      detail: message.detail ?? "",
      href: message.href,
      inApp: choice.inApp,
      emailStatus: choice.email ? ("pending" as const) : ("none" as const),
      dedupeKey: key,
    }));

  if (rows.length > 0) await db.insert(notifications).values(rows).onConflictDoNothing();
}

// Active members whose role lets them receive this kind of notification.
export async function peopleWhoCanReceive(event: NotificationEvent): Promise<{ id: string; name: string; email: string; timezone: string }[]> {
  const needed = NOTIFICATION_EVENTS.find((item) => item.event === event)?.who;
  const active = await db.select({ id: users.id, name: users.name, email: users.email, timezone: users.timezone, role: users.role }).from(users).where(eq(users.isActive, true));
  return active.filter((person) => !needed || hasPermission(person.role, needed));
}

// Tells a workflow's owner when someone else changes it. Repeated saves within the same hour count once.
export async function notifyOwnerOfChange(workflow: { id: string; name: string; createdById: string | null }, actor: { id: string; name: string }, change: "edited" | "published" | "renamed" | "deleted"): Promise<void> {
  if (!workflow.createdById || workflow.createdById === actor.id) return;
  const eligible = await peopleWhoCanReceive("review");
  if (!eligible.some((person) => person.id === workflow.createdById)) return;

  const hour = new Date().toISOString().slice(0, 13);
  const href = change === "deleted" ? "/activity" : `/workflows/${workflow.id}`;
  await notify([workflow.createdById], "review", { title: `${actor.name} ${change} your workflow ${workflow.name}`, href }, `review:${workflow.id}:${actor.id}:${change}:${hour}`);
}

// The owner if they can still receive it, or else every Administrator, so a failure is never told to nobody.
export async function ownerOrAdministrators(ownerId: string | null, event: NotificationEvent): Promise<string[]> {
  const eligible = await peopleWhoCanReceive(event);
  if (ownerId && eligible.some((person) => person.id === ownerId)) return [ownerId];
  const administrators = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "administrator"), eq(users.isActive, true)));
  return administrators.map((person) => person.id);
}
