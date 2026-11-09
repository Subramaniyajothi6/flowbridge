import { and, asc, eq, lte, sql } from "drizzle-orm";
import { config } from "../config.ts";
import { openConnection } from "../connections/client.ts";
import { db } from "../db/client.ts";
import { triggers, workflows } from "../db/schema.ts";
import { createRun } from "../engine/create-run.ts";
import { runHttpStep } from "../engine/steps/http-step.ts";
import { nextCronTime, nextPollTime, type PollConfig, type PollCursor, type ScheduleConfig } from "./definition.ts";
import { extractItems, planPoll } from "./poll.ts";

const MAX_TRIGGERS_PER_TICK = 20;

type Trigger = typeof triggers.$inferSelect;

export async function fireDueTriggers(): Promise<void> {
  const due = await db
    .select({ trigger: triggers, versionId: workflows.currentVersionId })
    .from(triggers)
    .innerJoin(workflows, eq(triggers.workflowId, workflows.id))
    .where(and(eq(triggers.enabled, true), lte(triggers.nextFireAt, sql`now()`)))
    .orderBy(asc(triggers.nextFireAt))
    .limit(MAX_TRIGGERS_PER_TICK);

  for (const { trigger, versionId } of due) {
    try {
      if (trigger.type === "schedule") await fireSchedule(trigger, versionId as string);
      else await firePoll(trigger, versionId as string);
    } catch (error) {
      await recordFailure(trigger, error);
    }
  }
}

// The run is created first and the next time saved second. If the app stops
// between the two, the same scheduled time fires again, and the idempotency
// key turns that into the existing run instead of a second one.
//
// If the app slept through several scheduled times, this runs once and moves
// on, so that waking up does not start a pile of identical runs.
async function fireSchedule(trigger: Trigger, versionId: string): Promise<void> {
  const scheduledFor = trigger.nextFireAt.toISOString();
  const now = new Date();

  await createRun({
    workflowId: trigger.workflowId,
    versionId,
    triggerType: "schedule",
    triggerData: { scheduledFor, firedAt: now.toISOString() },
    idempotencyKey: `schedule:${trigger.id}:${scheduledFor}`,
  });

  await markFired(trigger.id, nextCronTime(trigger.config as ScheduleConfig, now));
}

async function firePoll(trigger: Trigger, versionId: string): Promise<void> {
  const pollConfig = trigger.config as PollConfig;

  const body = await fetchPollBody(pollConfig);
  const items = extractItems(body, pollConfig.itemsPath);
  const plan = planPoll(items, pollConfig.itemIdField, trigger.cursor);

  for (const { id, item } of plan.newItems) {
    await createRun({
      workflowId: trigger.workflowId,
      versionId,
      triggerType: "poll",
      triggerData: { item },
      idempotencyKey: `poll:${trigger.id}:${id}`,
    });
  }

  await markFired(trigger.id, nextPollTime(pollConfig, new Date()), plan.nextCursor);
}

async function fetchPollBody(pollConfig: PollConfig): Promise<unknown> {
  if (pollConfig.connectionId) {
    const { request } = await openConnection(pollConfig.connectionId);
    return request(pollConfig.url, { headers: pollConfig.headers });
  }

  const response = await runHttpStep(
    { method: "GET", url: pollConfig.url, headers: pollConfig.headers },
    { allowPrivateUrls: config.ALLOW_PRIVATE_URLS, idempotencyKey: "" },
  );
  return response.body;
}

async function markFired(triggerId: string, nextFireAt: Date, cursor?: PollCursor): Promise<void> {
  await db
    .update(triggers)
    .set({ nextFireAt, cursor, lastFiredAt: new Date(), lastError: null })
    .where(eq(triggers.id, triggerId));
}

// A failing trigger keeps its normal timing and shows the reason, instead of retrying non-stop.
async function recordFailure(trigger: Trigger, error: unknown): Promise<void> {
  const now = new Date();
  const nextFireAt =
    trigger.type === "schedule"
      ? nextCronTime(trigger.config as ScheduleConfig, now)
      : nextPollTime(trigger.config as PollConfig, now);

  await db
    .update(triggers)
    .set({ nextFireAt, lastError: error instanceof Error ? error.message : String(error) })
    .where(eq(triggers.id, trigger.id));
}
