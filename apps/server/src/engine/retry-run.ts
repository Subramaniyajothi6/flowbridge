import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { runs, stepRuns, workflows } from "../db/schema.ts";
import { assertWithinRunLimit, createRun } from "./create-run.ts";
import { enqueueAdvanceRun } from "./queue.ts";

type Run = typeof runs.$inferSelect;

// A retry is always a new run, so the record of the original stays as it happened.
// It uses the published version, so that fixing a step and retrying works.
// A test run has no published version to move to, so it keeps the copy it was tested with.
async function versionForRetry(original: Run): Promise<string> {
  if (original.mode === "test") return original.versionId;
  const [workflow] = await db.select({ currentVersionId: workflows.currentVersionId }).from(workflows).where(eq(workflows.id, original.workflowId));
  return workflow?.currentVersionId ?? original.versionId;
}

export async function retryFromStart(original: Run, startedBy: string): Promise<Run> {
  const { run } = await createRun({
    workflowId: original.workflowId,
    versionId: await versionForRetry(original),
    triggerType: original.triggerType,
    triggerData: original.triggerData,
    retryOfRunId: original.id,
    mode: original.mode,
    startedBy,
  });
  return run;
}

// Copies every step that succeeded, so those are not repeated and no customer
// is created twice. Only the failed step and the ones after it run.
export async function retryFromFailedStep(original: Run, startedBy: string): Promise<Run> {
  if (original.mode === "live") await assertWithinRunLimit();
  const versionId = await versionForRetry(original);

  const run = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(runs)
      .values({
        workflowId: original.workflowId,
        versionId,
        triggerType: original.triggerType,
        triggerData: original.triggerData,
        retryOfRunId: original.id,
        mode: original.mode,
        startedBy,
        status: "queued",
      })
      .returning();

    const originalSteps = await tx.select().from(stepRuns).where(eq(stepRuns.runId, original.id));

    for (const step of originalSteps) {
      // A loop that failed part way keeps the items it finished, and carries on from there.
      const isPartialLoop = step.status === "failed" && (step.output as { results?: unknown[] } | null)?.results !== undefined;
      if (step.status !== "succeeded" && !isPartialLoop) continue;

      await tx.insert(stepRuns).values({
        runId: created.id,
        stepId: step.stepId,
        status: isPartialLoop ? "running" : "succeeded",
        attempt: isPartialLoop ? 0 : step.attempt,
        input: step.input,
        output: step.output,
        startedAt: step.startedAt,
        finishedAt: isPartialLoop ? null : step.finishedAt,
      });
    }
    return created;
  });

  await enqueueAdvanceRun(run.id);
  return run;
}

export async function findRun(runId: string): Promise<Run | undefined> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  return run;
}
