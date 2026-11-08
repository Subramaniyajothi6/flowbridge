import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { runs, stepRuns, workflowVersions } from "../db/schema.ts";
import type { WorkflowStep } from "./definition.ts";
import { findNextAction, type StepState } from "./next-action.ts";
import type { ReferenceContext } from "./references.ts";
import { resolveStepInput, runStep } from "./steps/run-step.ts";

// A step that keeps killing its worker must not be retried forever.
const MAX_STEP_ATTEMPTS = 3;

export type AdvanceResult = "more-to-do" | "finished";

export class RunBusyError extends Error {}

// Does one piece of work on a run: one step, or finishing the run.
// It reads where the run is from the database every time, so it is safe to
// call again after a crash, and safe to call twice.
export async function advanceRun(runId: string, workerId: string): Promise<AdvanceResult> {
  const run = await claimRun(runId, workerId);
  if (!run) return handleUnclaimedRun(runId);

  try {
    const [version] = await db.select().from(workflowVersions).where(eq(workflowVersions.id, run.versionId));
    const savedSteps = await db.select().from(stepRuns).where(eq(stepRuns.runId, runId));
    const states = new Map<string, StepState>(savedSteps.map((row) => [row.stepId, row]));
    const action = findNextAction(version.definition, states);

    if (action.type === "finish") {
      const failedStep = savedSteps.find((row) => row.status === "failed");
      await finishRun(runId, action.status, failedStep ? `Step "${failedStep.stepId}": ${failedStep.error}` : null);
      return "finished";
    }

    if (action.type === "skip") {
      await saveStep(runId, action.stepId, { status: "skipped", finishedAt: new Date() });
      return "more-to-do";
    }

    const step = version.definition.steps.find((item) => item.id === action.stepId) as WorkflowStep;
    const previousAttempts = savedSteps.find((row) => row.stepId === step.id)?.attempt ?? 0;
    await executeStep(run, step, previousAttempts + 1, buildContext(run.triggerData, savedSteps));
    return "more-to-do";
  } finally {
    await releaseRun(runId, workerId);
  }
}

// Takes ownership of a run, unless another worker currently owns it.
async function claimRun(runId: string, workerId: string) {
  const [run] = await db
    .update(runs)
    .set({
      status: "running",
      startedAt: sql`coalesce(${runs.startedAt}, now())`,
      leaseOwner: workerId,
      leaseExpiresAt: sql`now() + make_interval(secs => ${config.LEASE_SECONDS})`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(runs.id, runId),
        inArray(runs.status, ["queued", "running"]),
        or(isNull(runs.leaseExpiresAt), lt(runs.leaseExpiresAt, sql`now()`)),
      ),
    )
    .returning();
  return run;
}

async function handleUnclaimedRun(runId: string): Promise<AdvanceResult> {
  const [run] = await db.select({ status: runs.status }).from(runs).where(eq(runs.id, runId));
  if (!run || run.status === "succeeded" || run.status === "failed") return "finished";
  // Throwing makes the queue try this job again in a few seconds.
  throw new RunBusyError(`Run ${runId} is being processed by another worker`);
}

async function releaseRun(runId: string, workerId: string): Promise<void> {
  await db
    .update(runs)
    .set({ leaseOwner: null, leaseExpiresAt: null })
    .where(and(eq(runs.id, runId), eq(runs.leaseOwner, workerId)));
}

function buildContext(triggerData: unknown, savedSteps: { stepId: string; status: string; output: unknown }[]) {
  const context: ReferenceContext = { trigger: triggerData, steps: {} };
  for (const row of savedSteps) {
    if (row.status === "succeeded") context.steps[row.stepId] = { output: row.output };
  }
  return context;
}

async function executeStep(
  run: typeof runs.$inferSelect,
  step: WorkflowStep,
  attempt: number,
  context: ReferenceContext,
): Promise<void> {
  if (attempt > MAX_STEP_ATTEMPTS) {
    await saveStep(run.id, step.id, {
      status: "failed",
      error: `The worker stopped during this step ${MAX_STEP_ATTEMPTS} times`,
      finishedAt: new Date(),
    });
    return;
  }

  await saveStep(run.id, step.id, { status: "running", attempt, startedAt: new Date(), error: null });

  try {
    const input = resolveStepInput(step, context);
    await saveStep(run.id, step.id, { status: "running", input });
    const output = await runStep(step, input, {
      allowPrivateUrls: config.ALLOW_PRIVATE_URLS,
      // Stays the same across attempts, so a repeat is recognisable.
      idempotencyKey: `${run.id}:${step.id}`,
    });
    await saveStep(run.id, step.id, { status: "succeeded", output: output ?? null, finishedAt: new Date() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await saveStep(run.id, step.id, { status: "failed", error: message, finishedAt: new Date() });
  }
}

type StepChanges = Omit<Partial<typeof stepRuns.$inferInsert>, "status"> & {
  status: (typeof stepRuns.$inferInsert)["status"];
};

async function saveStep(runId: string, stepId: string, changes: StepChanges): Promise<void> {
  await db
    .insert(stepRuns)
    .values({ runId, stepId, ...changes })
    .onConflictDoUpdate({ target: [stepRuns.runId, stepRuns.stepId], set: changes });
}

async function finishRun(runId: string, status: "succeeded" | "failed", error: string | null): Promise<void> {
  await db
    .update(runs)
    .set({ status, error, finishedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(runs.id, runId));
}
