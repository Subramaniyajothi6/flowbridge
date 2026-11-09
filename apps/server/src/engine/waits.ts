import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { runs, stepRuns, type StepStatus, type WaitKind } from "../db/schema.ts";
import { enqueueAdvanceRun } from "./queue.ts";

// Delays, approvals and retry waits all use this one mechanism:
// the step is saved as "waiting", and something later wakes it up.
// Because the wait is a database row, it survives restarts and the host sleeping.

const MOST_WAKE_UPS_PER_CHECK = 50;

type StepChanges = { status: StepStatus; output?: unknown; error?: string; finishedAt?: Date };

export async function resumeDueWaits(): Promise<void> {
  const due = await db
    .select({ runId: stepRuns.runId, stepId: stepRuns.stepId, waitKind: stepRuns.waitKind, resumeAt: stepRuns.resumeAt })
    .from(stepRuns)
    .where(and(eq(stepRuns.status, "waiting"), lte(stepRuns.resumeAt, sql`now()`)))
    .limit(MOST_WAKE_UPS_PER_CHECK);

  for (const wait of due) {
    await wakeStep(wait.runId, wait.stepId, wait.waitKind as WaitKind, whenWaitEnds(wait.waitKind as WaitKind, wait.resumeAt));
  }
}

function whenWaitEnds(waitKind: WaitKind, resumeAt: Date | null): StepChanges {
  if (waitKind === "delay") return { status: "succeeded", output: { waitedUntil: resumeAt }, finishedAt: new Date() };
  if (waitKind === "approval") return { status: "failed", error: "Nobody approved or rejected this in time", finishedAt: new Date() };
  // A step marked as running is simply run again by the engine.
  return { status: "running" };
}

// Returns false if the step was not waiting, for example when two people decide at once.
async function wakeStep(runId: string, stepId: string, waitKind: WaitKind, changes: StepChanges): Promise<boolean> {
  const wasWoken = await db.transaction(async (tx) => {
    const updated = await tx
      .update(stepRuns)
      .set({ ...changes, waitKind: null, resumeAt: null })
      .where(and(eq(stepRuns.runId, runId), eq(stepRuns.stepId, stepId), eq(stepRuns.status, "waiting"), eq(stepRuns.waitKind, waitKind)))
      .returning({ id: stepRuns.id });
    if (updated.length === 0) return false;

    await tx
      .update(runs)
      .set({ status: "queued", updatedAt: sql`now()` })
      .where(and(eq(runs.id, runId), inArray(runs.status, ["queued", "running", "waiting"])));
    return true;
  });

  // Saved first and queued second. If the app stops between the two, the sweep queues it.
  if (wasWoken) await enqueueAdvanceRun(runId);
  return wasWoken;
}

export type ApprovalDecision = { approved: boolean; decidedBy: string; note?: string };

export function decideApproval(runId: string, stepId: string, decision: ApprovalDecision): Promise<boolean> {
  return wakeStep(runId, stepId, "approval", {
    status: "succeeded",
    output: {
      decision: decision.approved ? "approved" : "rejected",
      decidedBy: decision.decidedBy,
      note: decision.note ?? null,
      decidedAt: new Date().toISOString(),
    },
    finishedAt: new Date(),
  });
}
