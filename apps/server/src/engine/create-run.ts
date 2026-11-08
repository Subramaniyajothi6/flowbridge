import { and, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { runs, type RunTriggerType } from "../db/schema.ts";
import { enqueueAdvanceRun } from "./queue.ts";

type CreateRunInput = {
  workflowId: string;
  versionId: string;
  triggerType: RunTriggerType;
  triggerData: unknown;
  idempotencyKey?: string;
};

// Saves the run first and queues it second. If the app stops between the two,
// the worker's sweep finds the saved run and queues it.
export async function createRun(input: CreateRunInput) {
  const [created] = await db
    .insert(runs)
    .values({ ...input, status: "queued" })
    .onConflictDoNothing({ target: [runs.workflowId, runs.idempotencyKey] })
    .returning();

  if (!created) {
    const [existing] = await db
      .select()
      .from(runs)
      .where(and(eq(runs.workflowId, input.workflowId), eq(runs.idempotencyKey, input.idempotencyKey as string)));
    return { run: existing, isDuplicate: true };
  }

  await enqueueAdvanceRun(created.id);
  return { run: created, isDuplicate: false };
}
