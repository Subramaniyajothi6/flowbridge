import { desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import { activity, connections, triggers, workspace } from "../db/schema.ts";
import { ADVANCE_RUN_QUEUE, boss } from "../engine/queue.ts";
import { countLiveRunsThisMonth } from "../engine/create-run.ts";

const analyticsQuery = z.object({ days: z.coerce.number().int().refine((days) => [7, 14, 30].includes(days)).default(30) });

// Only live runs are counted everywhere on this page, so testing never skews the numbers.
async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

type Totals = { total: number; succeeded: number; failed: number; active: number; average_seconds: number };

async function runTotals(days: number): Promise<Totals> {
  const [totals] = await rows<Totals>(sql`
    select count(*)::int as total,
      count(*) filter (where status = 'succeeded')::int as succeeded,
      count(*) filter (where status = 'failed')::int as failed,
      count(*) filter (where status in ('queued', 'running', 'waiting'))::int as active,
      coalesce(avg(extract(epoch from finished_at - started_at)), 0)::float as average_seconds
    from runs
    where mode = 'live' and created_at >= now() - make_interval(days => ${days})`);
  return totals;
}

// Failed runs that nobody has retried yet, and approvals waiting for a person.
async function runsNeedingAttention() {
  return rows<{ id: string; workflow_name: string; status: string; error: string | null; step_id: string | null; created_at: string; message: unknown }>(sql`
    select r.id, w.name as workflow_name, r.status, r.error, s.step_id, r.created_at, s.input -> 'message' as message
    from runs r
    join workflows w on w.id = r.workflow_id
    left join step_runs s on s.run_id = r.id and s.status = 'waiting' and s.wait_kind = 'approval'
    where r.mode = 'live' and (
      (r.status = 'failed' and r.created_at >= now() - interval '7 days'
        and not exists (select 1 from runs retry where retry.retry_of_run_id = r.id))
      or s.id is not null)
    order by r.created_at desc
    limit 8`);
}

export function registerMonitoringRoutes(app: FastifyInstance): void {
  // Shown to everyone, in the top bar.
  app.get("/api/monitoring/usage", async () => {
    const [row] = await db.select({ limit: workspace.monthlyRunLimit }).from(workspace).where(eq(workspace.id, 1));
    const attention = await runsNeedingAttention();
    return { used: await countLiveRunsThisMonth(), limit: row?.limit ?? 0, needsAttention: attention.length };
  });

  app.get("/api/monitoring/overview", { preHandler: requirePermission("runs.view") }, async () => {
    const [workflowCounts] = await rows<{ total: number; published: number; drafts: number }>(sql`
      select count(*)::int as total,
        count(*) filter (where current_version_id is not null)::int as published,
        count(*) filter (where current_version_id is null)::int as drafts
      from workflows`);

    const mostUsed = await rows<{ id: string; name: string; runs: number }>(sql`
      select w.id, w.name, count(*)::int as runs
      from runs r join workflows w on w.id = r.workflow_id
      where r.mode = 'live' and r.created_at >= now() - interval '30 days'
      group by w.id, w.name order by runs desc limit 5`);

    const recent = await rows<{ id: string; workflow_name: string; status: string; created_at: string }>(sql`
      select r.id, w.name as workflow_name, r.status, r.created_at
      from runs r join workflows w on w.id = r.workflow_id
      where r.mode = 'live' order by r.created_at desc limit 6`);

    return {
      workflows: workflowCounts,
      runs: await runTotals(30),
      attention: await runsNeedingAttention(),
      mostUsed,
      recent,
      activity: await db.select().from(activity).orderBy(desc(activity.createdAt)).limit(6),
    };
  });

  app.get("/api/monitoring/analytics", { preHandler: requirePermission("runs.view") }, async (request) => {
    const { days } = analyticsQuery.parse(request.query);

    const daily = await rows<{ day: string; succeeded: number; failed: number; average_seconds: number }>(sql`
      select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day,
        count(*) filter (where status = 'succeeded')::int as succeeded,
        count(*) filter (where status = 'failed')::int as failed,
        coalesce(avg(extract(epoch from finished_at - started_at)), 0)::float as average_seconds
      from runs
      where mode = 'live' and created_at >= now() - make_interval(days => ${days})
      group by 1 order by 1`);

    const byWorkflow = await rows<{ id: string; name: string; runs: number; succeeded: number; failed: number; average_seconds: number }>(sql`
      select w.id, w.name, count(*)::int as runs,
        count(*) filter (where r.status = 'succeeded')::int as succeeded,
        count(*) filter (where r.status = 'failed')::int as failed,
        coalesce(avg(extract(epoch from r.finished_at - r.started_at)), 0)::float as average_seconds
      from runs r join workflows w on w.id = r.workflow_id
      where r.mode = 'live' and r.created_at >= now() - make_interval(days => ${days})
      group by w.id, w.name order by runs desc limit 20`);

    const failingSteps = await rows<{ workflow_name: string; step_id: string; failures: number; last_error: string }>(sql`
      select w.name as workflow_name, s.step_id, count(*)::int as failures, max(s.error) as last_error
      from step_runs s
      join runs r on r.id = s.run_id
      join workflows w on w.id = r.workflow_id
      where s.status = 'failed' and r.mode = 'live' and r.created_at >= now() - make_interval(days => ${days})
      group by w.name, s.step_id order by failures desc limit 10`);

    return { days, totals: await runTotals(days), daily, byWorkflow, failingSteps };
  });

  // For investigating problems with the platform itself.
  app.get("/api/monitoring/health", { preHandler: requirePermission("system.view") }, async () => {
    const startedAt = Date.now();
    await db.execute(sql`select 1`);
    const databaseMilliseconds = Date.now() - startedAt;

    const queue = await boss.getQueue(ADVANCE_RUN_QUEUE);

    const [runCounts] = await rows<{ waiting: number; stuck: number }>(sql`
      select count(*) filter (where status = 'waiting')::int as waiting,
        count(*) filter (where status in ('queued', 'running') and updated_at < now() - interval '5 minutes')::int as stuck
      from runs`);

    const brokenConnections = await db
      .select({ id: connections.id, connector: connections.connector, account: connections.account })
      .from(connections)
      .where(eq(connections.status, "needs_reconnect"));

    const failingTriggers = await rows<{ id: string; workflow_name: string; type: string; last_error: string }>(sql`
      select t.id, w.name as workflow_name, t.type, t.last_error
      from triggers t join workflows w on w.id = t.workflow_id
      where t.enabled and t.last_error is not null limit 10`);

    return {
      databaseMilliseconds,
      queuedJobs: queue?.queuedCount ?? 0,
      waitingRuns: runCounts.waiting,
      stuckRuns: runCounts.stuck,
      brokenConnections,
      failingTriggers,
      uptimeSeconds: Math.round(process.uptime()),
    };
  });
}
