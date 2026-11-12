import { and, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { activityVisibleTo } from "../auth/activity.ts";
import { hasPermission } from "../auth/permissions.ts";
import { currentUser, requirePermission } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import { activity, connections, notifications, users, workspace, type NotificationEvent } from "../db/schema.ts";
import { getConnector } from "../connectors/registry.ts";
import { ADVANCE_RUN_QUEUE, boss } from "../engine/queue.ts";
import { type FailedGroup, groupFailures } from "./failure-reasons.ts";
import { countLiveRunsThisMonth } from "../engine/create-run.ts";

const analyticsQuery = z.object({ days: z.coerce.number().int().refine((days) => [7, 14, 30].includes(days)).default(30) });

const ACTIVITY_PAGE_SIZE = 10;
const activityQuery = z.object({
  // Pages are numbered from 1.
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(100).optional(),
});

// Each step run, next to the saved definition of its step, so its type and app are known.
export const stepsWithDefinitions = sql`step_runs s
  join runs r on r.id = s.run_id
  join workflow_versions v on v.id = r.version_id
  join lateral jsonb_array_elements(v.definition -> 'steps') step on step ->> 'id' = s.step_id`;

// The app a step used. Web requests count as "HTTP request". Logic steps such as If use no app.
export const appOfStep = sql`case step ->> 'type'
  when 'connector' then step -> 'config' ->> 'connector'
  when 'http_request' then 'http_request'
  when 'loop' then coalesce(step -> 'config' -> 'action' -> 'config' ->> 'connector', 'http_request')
end`;

export function appName(app: string): string {
  if (app === "http_request") return "HTTP request";
  return getConnector(app)?.name ?? app;
}

// % and _ have special meanings in a LIKE pattern, so they are matched as ordinary characters.
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

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

type BellKind = "failed" | "approval" | "retry" | "connection" | "digest" | "review" | "invite";
type Notification = { id: string; kind: BellKind; text: string; detail: string | null; happenedAt: string; href: string };

const BELL_KIND: Record<NotificationEvent, BellKind> = { fail: "failed", digest: "digest", token: "connection", review: "review", invite: "invite" };

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

export function registerMonitoringRoutes(app: FastifyInstance): void {
  // The bell: approvals and retries happening now, plus what this person chose to see "In app" in Settings.
  app.get("/api/monitoring/notifications", async (request) => {
    const user = currentUser(request);
    const waiting = (await runNotifications()).filter((item) => item.kind !== "failed");
    const stored = await db
      .select({ id: notifications.id, event: notifications.event, title: notifications.title, detail: notifications.detail, href: notifications.href, createdAt: notifications.createdAt })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.inApp, true), gte(notifications.createdAt, sql`now() - interval '30 days'`)))
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    const items = [
      ...waiting,
      ...stored.map((item) => ({ id: item.id, kind: BELL_KIND[item.event], text: item.title, detail: item.detail || null, happenedAt: item.createdAt.toISOString(), href: item.href })),
    ].sort((first, second) => new Date(second.happenedAt).getTime() - new Date(first.happenedAt).getTime());

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
    const user = currentUser(request);

    // Someone who cannot edit workflows never sees drafts, so they are not counted for them.
    const [allCounts] = await rows<{ total: number; published: number; drafts: number }>(sql`
      select count(*)::int as total,
        count(*) filter (where current_version_id is not null)::int as published,
        count(*) filter (where current_version_id is null)::int as drafts
      from workflows`);
    const workflowCounts = hasPermission(user.role, "workflows.edit") ? allCounts : { total: allCounts.published, published: allCounts.published, drafts: 0 };

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
        .where(activityVisibleTo(user))
        .orderBy(desc(activity.createdAt))
        .limit(6),
    };
  });

  // The full activity history, newest first, one page at a time.
  app.get("/api/monitoring/activity", { preHandler: requirePermission("runs.view") }, async (request) => {
    const { page, search } = activityQuery.parse(request.query);
    const matching = and(
      activityVisibleTo(currentUser(request)),
      search ? or(ilike(activity.actorName, likePattern(search)), ilike(activity.description, likePattern(search))) : undefined,
    );

    const [items, [{ total }]] = await Promise.all([
      db
        .select({ id: activity.id, actorName: activity.actorName, description: activity.description, createdAt: activity.createdAt })
        .from(activity)
        .where(matching)
        // The id breaks ties, so entries made at the same moment keep one order across pages.
        .orderBy(desc(activity.createdAt), desc(activity.id))
        .limit(ACTIVITY_PAGE_SIZE)
        .offset((page - 1) * ACTIVITY_PAGE_SIZE),
      db.select({ total: count() }).from(activity).where(matching),
    ]);

    return { items, total, pageSize: ACTIVITY_PAGE_SIZE };
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

    const failedGroups = await rows<FailedGroup>(sql`
      select ${appOfStep} as app, s.error, count(*)::int as failures
      from ${stepsWithDefinitions}
      where s.status = 'failed' and r.mode = 'live' and r.created_at >= now() - make_interval(days => ${days})
      group by 1, 2`);

    const integrationUsage = await rows<{ app: string; steps: number }>(sql`
      select ${appOfStep} as app, count(*)::int as steps
      from ${stepsWithDefinitions}
      where s.status in ('succeeded', 'failed') and r.mode = 'live' and r.created_at >= now() - make_interval(days => ${days})
      group by 1 having ${appOfStep} is not null order by steps desc limit 12`);

    return {
      days,
      totals: await runTotals(days),
      daily,
      byWorkflow,
      failureReasons: groupFailures(failedGroups, appName),
      integrationUsage: integrationUsage.map((row) => ({ ...row, name: appName(row.app) })),
    };
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
