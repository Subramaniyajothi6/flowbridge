import { randomUUID } from "node:crypto";
import { and, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { removeOldActivity } from "../auth/activity.ts";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { runs } from "../db/schema.ts";
import { fireDueTriggers } from "../triggers/fire-triggers.ts";
import { advanceRun } from "./advance-run.ts";
import { ADVANCE_RUN_QUEUE, enqueueAdvanceRun, boss, type AdvanceRunJob } from "./queue.ts";
import { resumeDueWaits } from "./waits.ts";

const workerId = randomUUID();

// Runs several workflows side by side, so one slow workflow does not hold up the others.
const RUNS_AT_ONCE = 3;

const ONE_DAY_SECONDS = 24 * 60 * 60;

export async function startWorker(): Promise<() => void> {
  await boss.work<AdvanceRunJob>(
    ADVANCE_RUN_QUEUE,
    { pollingIntervalSeconds: 5, notifyPollingIntervalSeconds: 30, localConcurrency: RUNS_AT_ONCE },
    async ([job]) => processRun(job.data.runId),
  );

  const stopSweep = repeatWithoutOverlap(sweepAbandonedRuns, config.SWEEP_SECONDS, "Sweep");
  const stopTriggers = repeatWithoutOverlap(fireDueTriggers, config.TRIGGER_TICK_SECONDS, "Triggers");
  const stopWaits = repeatWithoutOverlap(resumeDueWaits, config.TRIGGER_TICK_SECONDS, "Waits");
  const stopActivityCleanup = repeatWithoutOverlap(removeOldActivity, ONE_DAY_SECONDS, "Activity clean-up");

  console.log(`Worker ${workerId} started`);
  return () => {
    stopSweep();
    stopTriggers();
    stopWaits();
    stopActivityCleanup();
  };
}

// Keeps working on one run, step after step, without going back through the queue.
// Stops well before the queue would treat the job as lost, and queues the rest.
async function processRun(runId: string): Promise<void> {
  const stopAt = Date.now() + (config.JOB_EXPIRE_SECONDS / 2) * 1000;

  while ((await advanceRun(runId, workerId)) === "more-to-do") {
    if (Date.now() > stopAt) {
      await enqueueAdvanceRun(runId);
      return;
    }
  }
}

// Runs a task now and then on a timer. Skips a turn if the last one has not finished.
function repeatWithoutOverlap(task: () => Promise<void>, seconds: number, name: string): () => void {
  let isRunning = false;

  const runOnce = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await task();
    } catch (error) {
      console.error(`${name} failed:`, error);
    } finally {
      isRunning = false;
    }
  };

  void runOnce();
  const timer = setInterval(runOnce, seconds * 1000);
  return () => clearInterval(timer);
}

// Finds unfinished runs that no worker owns and has not touched for a while,
// and queues them again. A run that is already queued is harmless to queue twice.
async function sweepAbandonedRuns(): Promise<void> {
  const abandoned = await db
    .select({ id: runs.id })
    .from(runs)
    .where(
      and(
        inArray(runs.status, ["queued", "running"]),
        or(isNull(runs.leaseExpiresAt), lt(runs.leaseExpiresAt, sql`now()`)),
        lt(runs.updatedAt, sql`now() - make_interval(secs => ${config.SWEEP_SECONDS})`),
      ),
    );

  for (const run of abandoned) await enqueueAdvanceRun(run.id);
}
