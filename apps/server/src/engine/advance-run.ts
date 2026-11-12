import { and, eq, exists, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { config } from "../config.ts";
import { censorSecrets } from "../connections/censor.ts";
import { db } from "../db/client.ts";
import { runs, stepRuns, workflowVersions, type AttemptRecord, type WaitKind } from "../db/schema.ts";
import { delayInSeconds, type WorkflowDefinition, type WorkflowStep } from "./definition.ts";
import { findNextAction, hasErrorPath, type StepState } from "./next-action.ts";
import { datesFrom, MissingReferenceError, resolveReferences, type ReferenceContext } from "./references.ts";
import { resolveStepInput, runStep } from "./steps/run-step.ts";

// A step that keeps killing its worker must not be retried forever.
const MAX_STEP_ATTEMPTS = 3;
const LONGEST_RETRY_WAIT_SECONDS = 3600;
export const MOST_LOOP_ITEMS = 100;

export type AdvanceResult = "more-to-do" | "paused" | "finished";

export class RunBusyError extends Error {}

type SavedStep = typeof stepRuns.$inferSelect;
type Run = typeof runs.$inferSelect;

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
      await finishRun(runId, action.status, describeFailure(version.definition, savedSteps));
      return "finished";
    }

    if (action.type === "wait") return pauseRun(runId);

    if (action.type === "skip") {
      await saveStep(runId, action.stepId, { status: "skipped", finishedAt: new Date() });
      return "more-to-do";
    }

    const step = version.definition.steps.find((item) => item.id === action.stepId) as WorkflowStep;
    const saved = savedSteps.find((row) => row.stepId === step.id);
    const dates = datesFrom(run.createdAt, await timeZoneForRun(run));
    await executeStep(run, step, saved, buildContext(run.triggerData, dates, savedSteps));
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
  if (run.status === "waiting") return "paused";
  // Throwing makes the queue try this job again in a few seconds.
  throw new RunBusyError(`Run ${runId} is being processed by another worker`);
}

async function releaseRun(runId: string, workerId: string): Promise<void> {
  await db
    .update(runs)
    .set({ leaseOwner: null, leaseExpiresAt: null })
    .where(and(eq(runs.id, runId), eq(runs.leaseOwner, workerId)));
}

// Marks the run as waiting, but only if a step is still waiting at this moment.
// An approval that arrived a moment ago must not leave the run stuck.
async function pauseRun(runId: string): Promise<AdvanceResult> {
  const stillWaiting = db
    .select({ id: stepRuns.id })
    .from(stepRuns)
    .where(and(eq(stepRuns.runId, runId), eq(stepRuns.status, "waiting")));

  const paused = await db
    .update(runs)
    .set({ status: "waiting", updatedAt: sql`now()` })
    .where(and(eq(runs.id, runId), exists(stillWaiting)))
    .returning({ id: runs.id });

  return paused.length > 0 ? "paused" : "more-to-do";
}

// Whose day "today" means in {{dates.today}}: the person who started the run, or else the
// person who created the workflow, for runs that a webhook or schedule started. Otherwise UTC.
async function timeZoneForRun(run: Run): Promise<string> {
  const result = await db.execute<{ timezone: string | null }>(sql`
    select coalesce(starter.timezone, creator.timezone) as timezone
    from workflows w
    left join users starter on starter.id = ${run.startedById}
    left join users creator on creator.id = w.created_by_id
    where w.id = ${run.workflowId}`);
  return result.rows[0]?.timezone ?? "UTC";
}

function buildContext(triggerData: unknown, dates: Record<string, string>, savedSteps: { stepId: string; status: string; output: unknown }[]) {
  const context: ReferenceContext = { trigger: triggerData, steps: {}, dates };
  for (const row of savedSteps) {
    if (row.status === "succeeded") context.steps[row.stepId] = { output: row.output };
  }
  return context;
}

function describeFailure(definition: WorkflowDefinition, savedSteps: SavedStep[]): string | null {
  const failed = savedSteps.find((row) => row.status === "failed" && !hasErrorPath(definition, row.stepId));
  return failed ? `Step "${failed.stepId}": ${failed.error}` : null;
}

async function executeStep(run: Run, step: WorkflowStep, saved: SavedStep | undefined, context: ReferenceContext): Promise<void> {
  const attempt = (saved?.attempt ?? 0) + 1;
  // A step that is retried keeps its first start time, so its duration covers every attempt.
  const startedAt = saved?.startedAt ?? new Date();

  if (attempt > Math.max(MAX_STEP_ATTEMPTS, step.retry?.maxAttempts ?? 1)) {
    await saveStep(run.id, step.id, {
      status: "failed",
      error: `The worker stopped during this step too many times`,
      finishedAt: new Date(),
    });
    return;
  }

  try {
    if (step.type === "delay") {
      await startWaiting(run.id, step.id, "delay", delayInSeconds(step.config), { attempt, startedAt, input: step.config });
      return;
    }

    if (step.type === "approval") {
      const input = { ...step.config, message: resolveReferences(step.config.message, context) };
      await startWaiting(run.id, step.id, "approval", step.config.timeoutHours * 3600, { attempt, startedAt, input });
      return;
    }

    if (step.type === "loop") {
      await runNextLoopItem(run, step, saved, attempt, startedAt, context);
      return;
    }

    const input = resolveStepInput(step, context);
    await saveStep(run.id, step.id, { status: "running", attempt, startedAt, input: censorSecrets(input), error: null });
    const output = await runStep(step, input, stepOptions(`${run.id}:${step.id}`));
    await saveStep(run.id, step.id, { status: "succeeded", output: censorSecrets(output) ?? null, finishedAt: new Date() });
  } catch (error) {
    await handleStepError(run.id, step, saved, attempt, startedAt, error);
  }
}

function stepOptions(idempotencyKey: string) {
  // The key stays the same across attempts, so a repeat is recognisable.
  return { allowPrivateUrls: config.ALLOW_PRIVATE_URLS, idempotencyKey };
}

async function startWaiting(
  runId: string,
  stepId: string,
  waitKind: WaitKind,
  seconds: number,
  fields: { attempt: number; startedAt: Date; input: unknown },
): Promise<void> {
  await saveStep(runId, stepId, {
    status: "waiting",
    waitKind,
    resumeAt: new Date(Date.now() + seconds * 1000),
    attempt: fields.attempt,
    startedAt: fields.startedAt,
    input: censorSecrets(fields.input),
    error: null,
  });
}

type LoopProgress = { results: unknown[] };

// Handles one item each time, so a lease only ever has to cover one call,
// and a crash only repeats the item that was in progress.
async function runNextLoopItem(
  run: Run,
  step: Extract<WorkflowStep, { type: "loop" }>,
  saved: SavedStep | undefined,
  attempt: number,
  startedAt: Date,
  context: ReferenceContext,
): Promise<void> {
  const items = resolveReferences(step.config.items, context);
  if (!Array.isArray(items)) throw new Error("The value given as Items is not a list");
  if (items.length > MOST_LOOP_ITEMS) throw new Error(`A loop can handle at most ${MOST_LOOP_ITEMS} items, and this list has ${items.length}`);

  const results = (saved?.output as LoopProgress | null)?.results ?? [];
  const index = results.length;

  if (index >= items.length) {
    await saveStep(run.id, step.id, { status: "succeeded", output: { count: items.length, results }, finishedAt: new Date() });
    return;
  }

  await saveStep(run.id, step.id, { status: "running", attempt, startedAt, input: censorSecrets({ itemCount: items.length }), output: { results }, error: null });

  const itemContext = { ...context, loop: { item: items[index], index } };
  const output = await runStep(step.config.action, resolveStepInput(step.config.action, itemContext), stepOptions(`${run.id}:${step.id}:${index}`));

  // The attempt count starts again for the next item.
  await saveStep(run.id, step.id, { status: "running", attempt: 0, output: { results: [...results, censorSecrets(output) ?? null] } });
}

async function handleStepError(runId: string, step: WorkflowStep, saved: SavedStep | undefined, attempt: number, startedAt: Date, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const maxAttempts = step.retry?.maxAttempts ?? 1;
  // A missing value will still be missing next time, so retrying cannot help.
  const canRetry = attempt < maxAttempts && !(error instanceof MissingReferenceError);
  const retryInSeconds = canRetry ? Math.min((step.retry?.delaySeconds ?? 1) * 2 ** (attempt - 1), LONGEST_RETRY_WAIT_SECONDS) : null;

  const record: AttemptRecord = { attempt, at: new Date().toISOString(), error: message, retryInSeconds };
  const attemptLog = [...(saved?.attemptLog ?? []), record];

  if (retryInSeconds === null) {
    await saveStep(runId, step.id, { status: "failed", attempt, startedAt, error: message, attemptLog, finishedAt: new Date() });
    return;
  }

  await saveStep(runId, step.id, {
    status: "waiting",
    waitKind: "retry",
    resumeAt: new Date(Date.now() + retryInSeconds * 1000),
    attempt,
    startedAt,
    error: message,
    attemptLog,
  });
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
