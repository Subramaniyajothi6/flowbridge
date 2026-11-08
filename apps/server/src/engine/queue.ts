import { PgBoss } from "pg-boss";
import { config } from "../config.ts";

export const ADVANCE_RUN_QUEUE = "advance-run";

export type AdvanceRunJob = { runId: string };

export const boss = new PgBoss({ connectionString: config.DATABASE_URL, max: 3 });

boss.on("error", (error) => console.error("Queue error:", error));

export async function startQueue(): Promise<void> {
  await boss.start();
  await boss.createQueue(ADVANCE_RUN_QUEUE, {
    retryLimit: 3,
    retryDelay: 5,
    expireInSeconds: config.JOB_EXPIRE_SECONDS,
  });
}

export async function enqueueAdvanceRun(runId: string): Promise<void> {
  const job: AdvanceRunJob = { runId };
  await boss.send(ADVANCE_RUN_QUEUE, job);
}
