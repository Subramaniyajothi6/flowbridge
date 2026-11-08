import { PgBoss } from "pg-boss";
import { config } from "../config.ts";

export const ADVANCE_RUN_QUEUE = "advance-run";

export type AdvanceRunJob = { runId: string };

// useListenNotify lets the database wake a worker as soon as a job is added,
// so workers do not have to keep asking whether there is new work.
export const boss = new PgBoss({ connectionString: config.DATABASE_URL, max: 3, useListenNotify: true });

boss.on("error", (error) => console.error("Queue error:", error));

export async function startQueue(): Promise<void> {
  const options = {
    retryLimit: 3,
    retryDelay: 5,
    expireInSeconds: config.JOB_EXPIRE_SECONDS,
    notify: true,
  };

  await boss.start();
  await boss.createQueue(ADVANCE_RUN_QUEUE, options);
  // createQueue leaves an existing queue alone, so this applies any changed settings.
  await boss.updateQueue(ADVANCE_RUN_QUEUE, options);
}

export async function enqueueAdvanceRun(runId: string): Promise<void> {
  const job: AdvanceRunJob = { runId };
  await boss.send(ADVANCE_RUN_QUEUE, job);
}
