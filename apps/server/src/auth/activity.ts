import { lt, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { activity } from "../db/schema.ts";

// How long the activity history is kept. Older entries are removed once a day.
export const ACTIVITY_KEEP_DAYS = 365;

export async function removeOldActivity(): Promise<void> {
  await db.delete(activity).where(lt(activity.createdAt, sql`now() - make_interval(days => ${ACTIVITY_KEEP_DAYS})`));
}

// "adminOnly" hides an entry from everyone except Administrators, for things like password resets.
export async function recordActivity(actorName: string, description: string, visibility: "everyone" | "adminOnly" = "everyone"): Promise<void> {
  await db.insert(activity).values({ actorName, description, isAdminOnly: visibility === "adminOnly" });
}
