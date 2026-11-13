import { and, eq, sql } from "drizzle-orm";
import { expiryOf } from "../api/connections.ts";
import { openConnection } from "../connections/client.ts";
import { getAction, getConnector } from "../connectors/registry.ts";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { connections, notifications } from "../db/schema.ts";
import { canReceiveEmail, localTime, SUMMARY_HOUR } from "./events.ts";
import { notify, ownerOrAdministrators, peopleWhoCanReceive } from "./notify.ts";

const DAY_MS = 86400 * 1000;
const EMAILS_AT_ONCE = 20;

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  return (await db.execute(query)).rows as T[];
}

// Live runs that failed in the last hour. Each is told about once, to the workflow's owner.
export async function notifyFailedRuns(): Promise<void> {
  const failed = await rows<{ id: string; workflow_name: string; owner_id: string | null; error: string | null; step_name: string | null }>(sql`
    select r.id, w.name as workflow_name, w.created_by_id as owner_id, r.error,
      (select step ->> 'name' from step_runs s
        join lateral jsonb_array_elements(v.definition -> 'steps') step on step ->> 'id' = s.step_id
        where s.run_id = r.id and s.status = 'failed' limit 1) as step_name
    from runs r
    join workflows w on w.id = r.workflow_id
    join workflow_versions v on v.id = r.version_id
    where r.mode = 'live' and r.status = 'failed' and r.finished_at >= now() - interval '1 hour'`);

  for (const run of failed) {
    const recipients = await ownerOrAdministrators(run.owner_id, "fail");
    const title = `${run.workflow_name} failed${run.step_name ? ` at ${run.step_name}` : ""}`;
    await notify(recipients, "fail", { title, detail: run.error ?? "", href: `/executions/${run.id}` }, `fail:${run.id}`);
  }
}

// Connections that stop working within 3 days, within 1 day, or have already stopped.
export async function notifyConnectionProblems(now = new Date()): Promise<void> {
  const all = await db.select({ id: connections.id, connector: connections.connector, account: connections.account, status: connections.status, createdAt: connections.createdAt, updatedAt: connections.updatedAt }).from(connections);
  const recipients = (await peopleWhoCanReceive("token")).map((person) => person.id);

  for (const connection of all) {
    const appName = getConnector(connection.connector)?.name ?? connection.connector;
    const detail = connection.account ? `Account ${connection.account}. Connect it again on the Integrations page.` : "Connect it again on the Integrations page.";

    if (connection.status === "needs_reconnect") {
      await notify(recipients, "token", { title: `The ${appName} connection needs connecting again`, detail, href: "/integrations" }, `token:reconnect:${connection.id}:${connection.updatedAt.toISOString()}`);
      continue;
    }

    const expiresAt = expiryOf(connection.connector, connection.createdAt);
    if (!expiresAt) continue;
    const msLeft = expiresAt.getTime() - now.getTime();
    if (msLeft <= 0 || msLeft > 3 * DAY_MS) continue;

    const stage = msLeft <= DAY_MS ? "1" : "3";
    const when = stage === "1" ? "within a day" : "in 3 days or less";
    await notify(recipients, "token", { title: `The ${appName} connection stops working ${when}`, detail, href: "/integrations" }, `token:expiry${stage}:${connection.id}:${connection.createdAt.toISOString()}`);
  }
}

// Once a day, during the 09:00 hour in each person's own time zone. Nothing is sent on a day with no failures.
export async function notifyDailySummaries(now = new Date()): Promise<void> {
  const failures = await rows<{ workflow_name: string; failures: number }>(sql`
    select w.name as workflow_name, count(*)::int as failures
    from runs r join workflows w on w.id = r.workflow_id
    where r.mode = 'live' and r.status = 'failed' and r.finished_at >= now() - interval '24 hours'
    group by w.name order by failures desc`);
  if (failures.length === 0) return;

  const total = failures.reduce((sum, row) => sum + row.failures, 0);
  const title = `${total} live ${total === 1 ? "run" : "runs"} failed in the past day`;
  const detail = failures.slice(0, 10).map((row) => `${row.workflow_name}: ${row.failures}`).join("\n");

  for (const person of await peopleWhoCanReceive("digest")) {
    const { hour, date } = localTime(now, person.timezone);
    if (hour !== SUMMARY_HOUR) continue;
    await notify([person.id], "digest", { title, detail, href: "/executions" }, `digest:${date}`);
  }
}

// Sends waiting emails from the workspace's connected Gmail account. A failed email is not tried again.
export async function sendPendingEmails(): Promise<void> {
  // Each email is claimed before it is sent. When two copies of the app share the database,
  // for example a laptop and the live site, only one of them can claim and send it.
  const pending = await rows<{ id: string; title: string; detail: string; href: string; to: string }>(sql`
    with claimed as (
      update notifications set email_status = 'sending'
      where id in (
        select id from notifications where email_status = 'pending'
        order by created_at limit ${EMAILS_AT_ONCE}
        for update skip locked)
      returning id, user_id, title, detail, href
    )
    select claimed.id, claimed.title, claimed.detail, claimed.href, users.email as "to"
    from claimed join users on users.id = claimed.user_id`);
  if (pending.length === 0) return;

  const [gmail] = await db.select({ id: connections.id }).from(connections).where(and(eq(connections.connector, "gmail"), eq(connections.status, "active"))).limit(1);
  const sendEmail = getAction("gmail", "send_email");
  const link = (config.PUBLIC_URL ?? `http://localhost:${config.PORT}`).replace(/\/+$/, "");

  for (const email of pending) {
    const markFailed = (reason: string) => db.update(notifications).set({ emailStatus: "failed", emailError: reason }).where(eq(notifications.id, email.id));

    if (!canReceiveEmail(email.to)) {
      await markFailed(`${email.to} cannot receive email`);
      continue;
    }
    if (!gmail || !sendEmail) {
      await markFailed("No Gmail account is connected, so emails cannot be sent");
      continue;
    }

    try {
      const { request } = await openConnection(gmail.id, "gmail");
      const body = `${email.detail ? `${email.detail}\n\n` : ""}Open in FlowBridge: ${link}${email.href}\n\nChoose which emails you get in Settings, Notifications.`;
      await sendEmail.run({ request, idempotencyKey: email.id }, { to: email.to, subject: `FlowBridge: ${email.title}`, body });
      await db.update(notifications).set({ emailStatus: "sent" }).where(eq(notifications.id, email.id));
    } catch (error) {
      await markFailed((error as Error).message.slice(0, 300));
    }
  }
}
