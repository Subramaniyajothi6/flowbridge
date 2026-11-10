import { db } from "../db/client.ts";
import { activity } from "../db/schema.ts";

// "adminOnly" hides an entry from everyone except Administrators, for things like password resets.
export async function recordActivity(actorName: string, description: string, visibility: "everyone" | "adminOnly" = "everyone"): Promise<void> {
  await db.insert(activity).values({ actorName, description, isAdminOnly: visibility === "adminOnly" });
}
