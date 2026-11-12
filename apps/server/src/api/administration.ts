import { asc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import { connections, users, workspace, type Role } from "../db/schema.ts";
import { getConnector } from "../connectors/registry.ts";
import { countLiveRunsThisMonth } from "../engine/create-run.ts";
import { adminTasks, isExpiringSoon, type ConnectionFacts, type LimitFacts } from "./admin-tasks.ts";
import { expiryOf, workflowsUsingConnections } from "./connections.ts";
import { failureReason } from "./failure-reasons.ts";
import { appName, appOfStep, stepsWithDefinitions } from "./monitoring.ts";

const ROLE_ORDER: Role[] = ["administrator", "workflow_builder", "business_user"];

// Apps that refused steps for reaching a limit in the last day, for example Gmail's daily sending limit.
async function recentLimitHits(): Promise<LimitFacts[]> {
  const result = await db.execute(sql`
    select ${appOfStep} as app, s.error, count(*)::int as failures
    from ${stepsWithDefinitions}
    where s.status = 'failed' and r.mode = 'live' and s.finished_at >= now() - interval '24 hours'
    group by 1, 2`);

  const byApp = new Map<string, number>();
  for (const row of result.rows as { app: string | null; error: string | null; failures: number }[]) {
    if (!row.app || failureReason(row.error) !== "Sending or usage limit reached") continue;
    const name = appName(row.app);
    byApp.set(name, (byApp.get(name) ?? 0) + row.failures);
  }
  return [...byApp].map(([name, failures]) => ({ appName: name, failures }));
}

// The Administrator's part of Overview: members, connections, run usage and what needs them.
export function registerAdministrationRoutes(app: FastifyInstance): void {
  app.get("/api/administration/overview", { preHandler: requirePermission("members.manage") }, async () => {
    const now = new Date();

    const members = await db
      .select({ name: users.name, role: users.role, createdAt: users.createdAt, lastSignInAt: users.lastSignInAt })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.name));

    const connectionRows = await db.select({ id: connections.id, connector: connections.connector, account: connections.account, status: connections.status, createdAt: connections.createdAt }).from(connections);
    const workflowTexts = await workflowsUsingConnections();
    const connectionFacts: ConnectionFacts[] = connectionRows.map((row) => ({
      appName: getConnector(row.connector)?.name ?? row.connector,
      account: row.account,
      status: row.status,
      expiresAt: expiryOf(row.connector, row.createdAt),
      workflowCount: workflowTexts.filter((workflow) => workflow.text.includes(row.id)).length,
    }));

    const [row] = await db.select({ limit: workspace.monthlyRunLimit }).from(workspace).where(eq(workspace.id, 1));
    const used = await countLiveRunsThisMonth();
    const limit = row?.limit ?? 0;

    return {
      members: { total: members.length, notSignedIn: members.filter((member) => !member.lastSignInAt).length },
      connections: {
        total: connectionFacts.length,
        needAttention: connectionFacts.filter((connection) => connection.status === "needs_reconnect" || isExpiringSoon(connection, now)).length,
      },
      runs: { used, limit },
      team: ROLE_ORDER.map((role) => ({
        role,
        people: members.filter((member) => member.role === role).map((member) => ({ name: member.name, hasSignedIn: member.lastSignInAt !== null })),
      })),
      tasks: adminTasks({ connections: connectionFacts, members, limitHits: await recentLimitHits(), used, limit, now }),
    };
  });
}
