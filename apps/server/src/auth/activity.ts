import { db } from "../db/client.ts";
import { activity } from "../db/schema.ts";

export async function recordActivity(actorName: string, description: string): Promise<void> {
  await db.insert(activity).values({ actorName, description });
}
