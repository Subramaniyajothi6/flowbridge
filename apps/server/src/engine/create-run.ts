import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { runs, workspace, type RunMode, type RunTriggerType } from "../db/schema.ts";
import { enqueueAdvanceRun } from "./queue.ts";

type CreateRunInput = {
  workflowId: string;
  versionId: string;
  triggerType: RunTriggerType;
  triggerData: unknown;
  idempotencyKey?: string;
  retryOfRunId?: string;
  mode?: RunMode;
  startedBy?: string;
  startedById?: string;
};

export class RunLimitError extends Error {
  statusCode = 429;
}

export async function countLiveRunsThisMonth(): Promise<number> {
  const [row] = await db
    .select({ used: count() })
    .from(runs)
    .where(and(eq(runs.mode, "live"), gte(runs.createdAt, sql`date_trunc('month', now())`)));
  return row.used;
}

// Protects the free database. Test runs do not count.
export async function assertWithinRunLimit(): Promise<void> {
  const [row] = await db.select({ limit: workspace.monthlyRunLimit }).from(workspace).where(eq(workspace.id, 1));
  if (row && (await countLiveRunsThisMonth()) >= row.limit) {
    throw new RunLimitError(`This workspace has used all ${row.limit} of its runs for this month`);
  }
}

// Saves the run first and queues it second. If the app stops between the two,
// the worker's sweep finds the saved run and queues it.
export async function createRun(input: CreateRunInput) {
  if ((input.mode ?? "live") === "live") await assertWithinRunLimit();

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
