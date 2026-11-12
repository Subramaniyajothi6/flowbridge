import { eq, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client.ts";
import { activity, type Role } from "../db/schema.ts";
import { hasPermission } from "./permissions.ts";

// How long the activity history is kept. Older entries are removed once a day.
export const ACTIVITY_KEEP_DAYS = 365;

export async function removeOldActivity(): Promise<void> {
  await db.delete(activity).where(lt(activity.createdAt, sql`now() - make_interval(days => ${ACTIVITY_KEEP_DAYS})`));
}

type Actor = { id: string; name: string };

type ActivityOptions = {
  // Member, password, settings and logo changes. Only Administrators, and the person it is about, see these.
  adminOnly?: boolean;
  // The member this entry is about, such as the person whose password was reset.
  aboutUserId?: string;
  // Changes everyone who runs workflows should know about, such as a new published version.
  shownToAll?: boolean;
};

export async function recordActivity(actor: Actor, description: string, options: ActivityOptions = {}): Promise<void> {
  await db.insert(activity).values({
    actorName: actor.name,
    actorId: actor.id,
    description,
    isAdminOnly: options.adminOnly ?? false,
    aboutUserId: options.aboutUserId ?? null,
    shownToAll: options.shownToAll ?? false,
  });
}

// Which entries a person may see.
// Administrators: everything. Workflow Builders: everything except admin-only entries about other people.
// Business Users: what they did, what is about them, and changes to the workflows everyone runs.
export function activityVisibleTo(user: { id: string; role: Role }): SQL | undefined {
  if (hasPermission(user.role, "members.manage")) return undefined;
  const mine = or(eq(activity.actorId, user.id), eq(activity.aboutUserId, user.id)) as SQL;
  if (hasPermission(user.role, "workflows.edit")) return or(eq(activity.isAdminOnly, false), mine);
  return or(mine, eq(activity.shownToAll, true));
}
