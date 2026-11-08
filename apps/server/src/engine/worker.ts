import { randomUUID } from "node:crypto";
import { and, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { runs } from "../db/schema.ts";
import { advanceRun } from "./advance-run.ts";
import { ADVANCE_RUN_QUEUE, enqueueAdvanceRun, boss, type AdvanceRunJob } from "./queue.ts";

const workerId = randomUUID();

export async function startWorker(): Promise<() => void> {
  await boss.work<AdvanceRunJob>(ADVANCE_RUN_QUEUE, { pollingIntervalSeconds: 5 }, async ([job]) => {
    const result = await advanceRun(job.data.runId, workerId);
    if (result === "more-to-do") await enqueueAdvanceRun(job.data.runId);
  });

  await sweepAbandonedRuns();
  const timer = setInterval(() => {
    sweepAbandonedRuns().catch((error) => console.error("Sweep failed:", error));
  }, config.SWEEP_SECONDS * 1000);

  console.log(`Worker ${workerId} started`);
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
