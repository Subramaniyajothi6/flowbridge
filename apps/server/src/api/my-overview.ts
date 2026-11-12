import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { currentUser, requirePermission } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import type { WorkflowDefinition } from "../engine/definition.ts";
import { plainFailure, runSentence, serviceOf } from "./plain-words.ts";

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  return (await db.execute(query)).rows as T[];
}

// The Overview for people who run workflows rather than build them:
// decisions waiting for them, failures they can retry, and their own recent runs.
export function registerMyOverviewRoutes(app: FastifyInstance): void {
  app.get("/api/my/overview", { preHandler: requirePermission("runs.view") }, async (request) => {
    const me = currentUser(request);

    const approvals = await rows<{ run_id: string; step_id: string; workflow_name: string; step_name: string | null; message: unknown; waiting_since: string; decide_by: string | null }>(sql`
      select r.id as run_id, s.step_id, w.name as workflow_name,
        (select step ->> 'name' from jsonb_array_elements(v.definition -> 'steps') step where step ->> 'id' = s.step_id) as step_name,
        s.input -> 'message' as message, s.started_at as waiting_since, s.resume_at as decide_by
      from step_runs s
      join runs r on r.id = s.run_id
      join workflows w on w.id = r.workflow_id
      join workflow_versions v on v.id = r.version_id
      where r.mode = 'live' and s.status = 'waiting' and s.wait_kind = 'approval'
      order by s.started_at asc`);

    // Failed live runs from the last week that nobody has retried yet, and whose data is still kept.
    const failed = await rows<{ id: string; workflow_name: string; error: string | null; created_at: string; failed_step_id: string | null; definition: WorkflowDefinition }>(sql`
      select r.id, w.name as workflow_name, r.error, r.created_at, v.definition,
        (select s.step_id from step_runs s where s.run_id = r.id and s.status = 'failed' limit 1) as failed_step_id
      from runs r
      join workflows w on w.id = r.workflow_id
      join workflow_versions v on v.id = r.version_id
      where r.mode = 'live' and r.status = 'failed' and r.data_removed_at is null
        and r.created_at >= now() - interval '7 days'
        and not exists (select 1 from runs retry where retry.retry_of_run_id = r.id)
      order by r.created_at desc`);

    const [myWeek] = await rows<{ succeeded: number; failed: number; active: number }>(sql`
      select count(*) filter (where status = 'succeeded')::int as succeeded,
        count(*) filter (where status = 'failed')::int as failed,
        count(*) filter (where status in ('queued', 'running', 'waiting'))::int as active
      from runs
      where mode = 'live' and started_by_id = ${me.id} and created_at >= now() - interval '7 days'`);

    // Live runs from today, in the person's own time zone. On a quiet day, the latest few instead.
    type StoryRow = { id: string; workflow_name: string; status: string; error: string | null; created_at: string; started_by_id: string | null; wait_kind: string | null; failed_step_id: string | null; definition: WorkflowDefinition };
    const storyColumns = sql`r.id, w.name as workflow_name, r.status, r.error, r.created_at, r.started_by_id, v.definition,
      (select s.wait_kind from step_runs s where s.run_id = r.id and s.status = 'waiting' limit 1) as wait_kind,
      (select s.step_id from step_runs s where s.run_id = r.id and s.status = 'failed' limit 1) as failed_step_id`;
    const startOfToday = sql`(date_trunc('day', now() at time zone ${me.timezone}) at time zone ${me.timezone})`;
    let isToday = true;
    let storyRows = await rows<StoryRow>(sql`
      select ${storyColumns} from runs r join workflows w on w.id = r.workflow_id join workflow_versions v on v.id = r.version_id
      where r.mode = 'live' and r.created_at >= ${startOfToday} order by r.created_at desc limit 12`);
    if (storyRows.length === 0) {
      isToday = false;
      storyRows = await rows<StoryRow>(sql`
        select ${storyColumns} from runs r join workflows w on w.id = r.workflow_id join workflow_versions v on v.id = r.version_id
        where r.mode = 'live' order by r.created_at desc limit 8`);
    }

    const story = storyRows.map((run) => {
      const failedStep = run.definition.steps.find((step) => step.id === run.failed_step_id);
      const sentence = runSentence({
        workflowName: run.workflow_name,
        status: run.status,
        waitKind: run.wait_kind,
        failedStepName: failedStep?.name ?? null,
        reason: run.status === "failed" ? plainFailure(serviceOf(failedStep), run.error).text : null,
      });
      return { id: run.id, text: sentence.text, tone: sentence.tone, at: run.created_at, startedByYou: run.started_by_id === me.id };
    });

    return {
      story,
      storyIsToday: isToday,
      approvals: approvals.map((item) => ({
        runId: item.run_id,
        stepId: item.step_id,
        workflowName: item.workflow_name,
        stepName: item.step_name,
        message: typeof item.message === "string" ? item.message : "",
        waitingSince: item.waiting_since,
        decideBy: item.decide_by,
      })),
      failures: failed.slice(0, 6).map((run) => {
        const step = run.definition.steps.find((item) => item.id === run.failed_step_id);
        const explained = plainFailure(serviceOf(step), run.error);
        return { id: run.id, workflowName: run.workflow_name, createdAt: run.created_at, stepName: step?.name ?? null, reason: explained.text, retryHelps: explained.retryHelps };
      }),
      failureCount: failed.length,
      myWeek,
    };
  });
}
