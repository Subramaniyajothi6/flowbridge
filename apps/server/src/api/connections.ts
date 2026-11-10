import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { recordActivity } from "../auth/activity.ts";
import { currentUser, requirePermission } from "../auth/sessions.ts";
import { openConnection } from "../connections/client.ts";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  isProviderConfigured,
  oauthRedirectUri,
} from "../connections/oauth.ts";
import { sealCredentials, type Credentials } from "../connections/secrets.ts";
import { connectors, getConnector } from "../connectors/registry.ts";
import type { Connector } from "../connectors/types.ts";
import { db } from "../db/client.ts";
import { config } from "../config.ts";
import { connections, oauthStates, workflows, workflowVersions } from "../db/schema.ts";

const idParams = z.object({ id: z.uuid() });
const connectorParams = z.object({ connector: z.string() });
const startQuery = z.object({ name: z.string().min(1).max(100).optional() });
const callbackQuery = z.object({
  state: z.string().optional(),
  code: z.string().optional(),
  error: z.string().optional(),
});
const createTokenConnectionBody = z.object({
  connector: z.string(),
  name: z.string().min(1).max(100).optional(),
  token: z.string().trim().min(1),
});

const OAUTH_STATE_MINUTES = 10;

// Chosen column by column, so the encrypted credentials can never reach a response.
const publicColumns = {
  id: connections.id,
  connector: connections.connector,
  name: connections.name,
  account: connections.account,
  status: connections.status,
  createdBy: connections.createdBy,
  lastCheckedAt: connections.lastCheckedAt,
  createdAt: connections.createdAt,
};

// When a connection will stop working on its own, or null if it does not expire.
function expiryOf(connectorId: string, createdAt: Date): Date | null {
  const connector = getConnector(connectorId);
  const isGoogle = connector?.auth.type === "oauth" && connector.auth.provider === "google";
  if (!isGoogle || config.GOOGLE_CONNECTION_DAYS <= 0) return null;
  return new Date(createdAt.getTime() + config.GOOGLE_CONNECTION_DAYS * 86400 * 1000);
}

// A workflow uses a connection if its published version or its draft mentions the connection's ID.
async function workflowsUsingConnections(): Promise<{ id: string; name: string; text: string }[]> {
  const rows = await db
    .select({ id: workflows.id, name: workflows.name, draft: workflows.draftDefinition, published: workflowVersions.definition })
    .from(workflows)
    .leftJoin(workflowVersions, eq(workflows.currentVersionId, workflowVersions.id));
  return rows.map((row) => ({ id: row.id, name: row.name, text: JSON.stringify([row.draft, row.published]) }));
}

function humanizeConnector(connectorId: string): string {
  return getConnector(connectorId)?.name ?? connectorId;
}

function isConfigured(connector: Connector): boolean {
  return connector.auth.type === "token" || isProviderConfigured(connector.auth.provider);
}

function describeConnector(connector: Connector) {
  const { auth } = connector;
  return {
    id: connector.id,
    name: connector.name,
    authType: auth.type,
    configured: isConfigured(connector),
    customHost: connector.customHost,
    tokenLabel: auth.type === "token" ? auth.label : undefined,
    tokenHelp: auth.type === "token" ? auth.help : undefined,
    actions: Object.entries(connector.actions).map(([id, action]) => ({
      id,
      description: action.description,
      inputSchema: z.toJSONSchema(action.input, { io: "input", unrepresentable: "any" }),
    })),
  };
}

async function saveConnection(connector: Connector, name: string, credentials: Credentials, createdBy: string | null): Promise<string> {
  const [created] = await db
    .insert(connections)
    .values({ connector: connector.id, name, encryptedCredentials: sealCredentials(credentials), createdBy })
    .returning({ id: connections.id });
  return created.id;
}

// Makes a real call to the service, and records which account it belongs to.
async function verifyConnection(connectionId: string): Promise<string> {
  const { connector, request } = await openConnection(connectionId);
  const { account } = await connector.test({ request, idempotencyKey: "" });
  await db
    .update(connections)
    .set({ account, status: "active", lastCheckedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(connections.id, connectionId));
  return account;
}

export function registerConnectionRoutes(app: FastifyInstance): void {
  const canView = { preHandler: requirePermission("integrations.view") };
  const canManage = { preHandler: requirePermission("integrations.manage") };

  app.get("/api/connectors", canView, async () => Object.values(connectors).map(describeConnector));

  app.get("/api/connections", canView, async () => {
    const rows = await db.select(publicColumns).from(connections).orderBy(desc(connections.createdAt));
    const workflowTexts = await workflowsUsingConnections();

    return rows.map((row) => ({
      ...row,
      expiresAt: expiryOf(row.connector, row.createdAt),
      usedBy: workflowTexts.filter((workflow) => workflow.text.includes(row.id)).map(({ id, name }) => ({ id, name })),
    }));
  });

  app.post("/api/connections", canManage, async (request, reply) => {
    const body = createTokenConnectionBody.parse(request.body);
    const connector = getConnector(body.connector);
    if (!connector || connector.auth.type !== "token") {
      return reply.status(400).send({ error: "This connector does not use a token" });
    }
    if (!connector.auth.pattern.test(body.token)) {
      return reply.status(400).send({ error: connector.auth.patternMessage });
    }

    const id = await saveConnection(connector, body.name ?? connector.name, { type: "token", token: body.token }, currentUser(request).name);
    try {
      const account = await verifyConnection(id);
      await recordActivity(currentUser(request).name, `connected ${connector.name}`);
      return reply.status(201).send({ id, account });
    } catch (error) {
      // A credential that does not work is not kept.
      await db.delete(connections).where(eq(connections.id, id));
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  app.post("/api/connections/:id/test", canView, async (request) => {
    const { id } = idParams.parse(request.params);
    try {
      return { ok: true, account: await verifyConnection(id) };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  });

  app.delete("/api/connections/:id", canManage, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [deleted] = await db.delete(connections).where(eq(connections.id, id)).returning({ connector: connections.connector });
    if (!deleted) return reply.status(404).send({ error: "Connection not found" });
    await recordActivity(currentUser(request).name, `removed a ${humanizeConnector(deleted.connector)} connection`);
    return reply.status(204).send();
  });

  // Sends the person to the provider's sign-in page.
  app.get("/api/connections/oauth/:connector/start", canManage, async (request, reply) => {
    const params = connectorParams.parse(request.params);
    const { name } = startQuery.parse(request.query);
    const connector = getConnector(params.connector);
    if (!connector || connector.auth.type !== "oauth") {
      return reply.status(400).send({ error: "This connector does not use OAuth" });
    }
    if (!isProviderConfigured(connector.auth.provider)) {
      return reply.status(400).send({ error: "This provider has not been set up on the server yet" });
    }

    // A random value that must come back unchanged, which proves the reply
    // belongs to a sign-in that was started here.
    const state = randomBytes(24).toString("hex");
    await db.insert(oauthStates).values({
      state,
      connector: connector.id,
      name: name ?? connector.name,
      expiresAt: new Date(Date.now() + OAUTH_STATE_MINUTES * 60_000),
    });
    return reply.redirect(buildAuthorizeUrl(connector.auth.provider, connector.auth.scopes, state));
  });

  // The provider sends the person back here after they approve.
  app.get("/api/connections/oauth/callback", async (request, reply) => {
    const query = callbackQuery.parse(request.query);
    const fail = (message: string) => reply.redirect(`/integrations?error=${encodeURIComponent(message)}`);

    if (!query.state) return fail("The sign-in reply was incomplete");

    // Deleting as it is read means each sign-in can only be used once.
    const [pending] = await db
      .delete(oauthStates)
      .where(and(eq(oauthStates.state, query.state), gt(oauthStates.expiresAt, sql`now()`)))
      .returning();
    if (!pending) return fail("This sign-in has expired. Please try again.");
    if (query.error || !query.code) return fail("Access was not granted");

    const connector = getConnector(pending.connector);
    if (!connector || connector.auth.type !== "oauth") return fail("Unknown connector");

    let id: string | undefined;
    try {
      const tokens = await exchangeCodeForTokens(connector.auth.provider, query.code);
      if (!tokens.refreshToken) return fail("Google did not provide long-term access. Please try again.");

      id = await saveConnection(connector, pending.name, {
        type: "oauth",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      }, request.user?.name ?? null);
      await verifyConnection(id);
      if (request.user) await recordActivity(request.user.name, `connected ${connector.name}`);
      return reply.redirect("/integrations?connected=1");
    } catch (error) {
      if (id) await db.delete(connections).where(eq(connections.id, id));
      request.log.error(error);
      return fail((error as Error).message);
    }
  });

  app.get("/api/connections/oauth/redirect-uri", canManage, async () => ({ redirectUri: oauthRedirectUri() }));
}
