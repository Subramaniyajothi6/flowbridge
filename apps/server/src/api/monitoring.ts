import { desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hasPermission } from "../auth/permissions.ts";
import { currentUser, requirePermission } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import { activity, connections, users, workspace } from "../db/schema.ts";
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

type Notification = { id: string; kind: "failed" | "approval" | "retry" | "connection"; text: string; detail: string | null; happenedAt: string; href: string };

type NotifiableRun = { id: string; workflow_name: string; status: string; error: string | null; happened_at: string; wait_kind: string | null; step_name: string | null };

// Worked out from the runs themselves, so a notification can never disagree with what really happened.
async function runNotifications(): Promise<Notification[]> {
  const found = await rows<NotifiableRun>(sql`
    select r.id, w.name as workflow_name, r.status, r.error, r.updated_at as happened_at, s.wait_kind,
      (select step ->> 'name' from jsonb_array_elements(v.definition -> 'steps') step where step ->> 'id' = s.step_id) as step_name
    from runs r
    join workflows w on w.id = r.workflow_id
    join workflow_versions v on v.id = r.version_id
    left join step_runs s on s.run_id = r.id and (
      (r.status = 'failed' and s.status = 'failed')
      or (r.status = 'waiting' and s.status = 'waiting' and s.wait_kind in ('approval', 'retry')))
    where r.mode = 'live' and (
      (r.status = 'failed' and r.created_at >= now() - interval '7 days'
        and not exists (select 1 from runs retry where retry.retry_of_run_id = r.id))
      or (r.status = 'waiting' and s.id is not null))
    order by r.updated_at desc
    limit 10`);

  // A run can have more than one matching step, and only needs one notification.
  const oncePerRun = [...new Map(found.map((run) => [run.id, run])).values()];

  return oncePerRun.map((run) => {
    const shared = { id: run.id, happenedAt: run.happened_at, href: `/executions/${run.id}` };
    const step = run.step_name ?? "a step";
    if (run.status === "failed") return { ...shared, kind: "failed", text: `${run.workflow_name} failed at ${step}`, detail: run.error };
    if (run.wait_kind === "approval") return { ...shared, kind: "approval", text: `${run.workflow_name} is waiting for a decision at ${step}`, detail: null };
    return { ...shared, kind: "retry", text: `${run.workflow_name} is retrying ${step} after a failure`, detail: null };
  });
}

async function connectionNotifications(): Promise<Notification[]> {
  const broken = await db
    .select({ id: connections.id, name: connections.name, updatedAt: connections.updatedAt })
    .from(connections)
    .where(eq(connections.status, "needs_reconnect"));

  return broken.map((connection) => ({
    id: connection.id,
    kind: "connection",
    text: `${connection.name} needs connecting again`,
    detail: null,
    happenedAt: connection.updatedAt.toISOString(),
    href: "/integrations",
  }));
}

export function registerMonitoringRoutes(app: FastifyInstance): void {
  app.get("/api/monitoring/notifications", async (request) => {
    const user = currentUser(request);
    const canSeeConnections = hasPermission(user.role, "integrations.view");
    const items = [...(await runNotifications()), ...(canSeeConnections ? await connectionNotifications() : [])]
      .sort((first, second) => new Date(second.happenedAt).getTime() - new Date(first.happenedAt).getTime());

    const readUpTo = user.notificationsReadAt?.getTime() ?? 0;
    return { items, unread: items.filter((item) => new Date(item.happenedAt).getTime() > readUpTo).length };
  });

  app.post("/api/monitoring/notifications/read", async (request, reply) => {
    await db.update(users).set({ notificationsReadAt: sql`now()` }).where(eq(users.id, currentUser(request).id));
    return reply.status(204).send();
  });

  // Shown to everyone, in the top bar.
  app.get("/api/monitoring/usage", async () => {
    const [row] = await db.select({ limit: workspace.monthlyRunLimit }).from(workspace).where(eq(workspace.id, 1));
    const attention = await runsNeedingAttention();
    return { used: await countLiveRunsThisMonth(), limit: row?.limit ?? 0, needsAttention: attention.length };
  });

  app.get("/api/monitoring/overview", { preHandler: requirePermission("runs.view") }, async (request) => {
    // Member, password and workspace changes are left out for everyone but Administrators.
    const isAdministrator = hasPermission(currentUser(request).role, "members.manage");

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
      activity: await db
        .select({ id: activity.id, actorName: activity.actorName, description: activity.description, createdAt: activity.createdAt })
        .from(activity)
        .where(isAdministrator ? undefined : eq(activity.isAdminOnly, false))
        .orderBy(desc(activity.createdAt))
        .limit(6),
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
