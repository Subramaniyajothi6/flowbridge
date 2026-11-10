import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { connections } from "../db/schema.ts";
import { getConnector } from "../connectors/registry.ts";
import type { Connector, ConnectorRequest } from "../connectors/types.ts";
import { parseBody, readLimitedText } from "../engine/steps/http-step.ts";
import { HIDDEN } from "./censor.ts";
import { ReconnectNeededError, refreshAccessToken, type OAuthProviderName } from "./oauth.ts";
import { openCredentials, sealCredentials, type Credentials } from "./secrets.ts";

// Refreshes slightly early, so a token cannot expire during a request.
const REFRESH_EARLY_MS = 60_000;
const TIMEOUT_MS = 30_000;

type OAuthCredentials = Extract<Credentials, { type: "oauth" }>;

function isExpiring(credentials: OAuthCredentials): boolean {
  return credentials.expiresAt - Date.now() < REFRESH_EARLY_MS;
}

export type OpenConnection = { connector: Connector; request: ConnectorRequest };

export async function openConnection(connectionId: string, expectedConnectorId?: string): Promise<OpenConnection> {
  const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId));
  if (!connection) throw new Error("This connection no longer exists");

  const connector = getConnector(connection.connector);
  if (!connector) throw new Error(`Unknown connector "${connection.connector}"`);
  if (expectedConnectorId && connector.id !== expectedConnectorId) {
    throw new Error(`This step needs a ${expectedConnectorId} connection, but this one is ${connector.id}`);
  }
  if (connection.status === "needs_reconnect") {
    throw new Error(`The ${connector.name} connection has expired. Please connect it again.`);
  }

  const secret = await getUsableSecret(connection, connector);
  return { connector, request: buildRequest(connector, secret) };
}

async function getUsableSecret(connection: typeof connections.$inferSelect, connector: Connector): Promise<string> {
  const credentials = openCredentials(connection.encryptedCredentials);
  if (credentials.type === "token") return credentials.token;
  if (!isExpiring(credentials)) return credentials.accessToken;
  if (connector.auth.type !== "oauth") throw new Error("This connector does not use OAuth");
  return refreshWhileLocked(connection.id, connector.auth.provider, connector.name);
}

// Several steps can notice an expired token at the same moment. The row lock
// makes them take turns, and each reads the row again after getting the lock.
// So only the first one refreshes, and the rest use the token it saved.
async function refreshWhileLocked(connectionId: string, provider: OAuthProviderName, name: string): Promise<string> {
  const accessToken = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(connections).where(eq(connections.id, connectionId)).for("update");
    const current = openCredentials(row.encryptedCredentials) as OAuthCredentials;
    if (!isExpiring(current)) return current.accessToken;

    try {
      const tokens = await refreshAccessToken(provider, current.refreshToken);
      const updated: OAuthCredentials = {
        type: "oauth",
        accessToken: tokens.accessToken,
        // Google usually does not send a new refresh token, so the old one is kept.
        refreshToken: tokens.refreshToken ?? current.refreshToken,
        expiresAt: tokens.expiresAt,
      };
      await tx
        .update(connections)
        .set({ encryptedCredentials: sealCredentials(updated), updatedAt: sql`now()` })
        .where(eq(connections.id, connectionId));
      return tokens.accessToken;
    } catch (error) {
      if (!(error instanceof ReconnectNeededError)) throw error;
      await tx.update(connections).set({ status: "needs_reconnect", updatedAt: sql`now()` }).where(eq(connections.id, connectionId));
      return null;
    }
  });

  if (accessToken === null) throw new Error(`The ${name} connection has expired. Please connect it again.`);
  return accessToken;
}

function buildRequest(connector: Connector, secret: string): ConnectorRequest {
  return async (url, options = {}) => {
    const target = new URL(url);
    if (!connector.allowedHosts.includes(target.hostname)) {
      throw new Error(`${connector.name} credentials cannot be sent to ${target.hostname}`);
    }
    await connector.checkBeforeSend?.(target);

    const credentialHeaders = connector.credentialHeaders?.(secret) ?? { authorization: `Bearer ${secret}` };
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: { ...options.headers, ...credentialHeaders },
      body: options.body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
    });

    // A service can repeat back what it was sent, and replies are saved and shown to people.
    const text = hideCredential(await readLimitedText(response), [secret, ...Object.values(credentialHeaders)]);
    const body = parseBody(text, response.headers.get("content-type"));
    if (!response.ok) {
      throw new Error(`${connector.name} replied with status ${response.status}: ${describeError(body)}`);
    }
    return body;
  };
}

function hideCredential(text: string, values: string[]): string {
  return values.reduce((result, value) => result.replaceAll(value, HIDDEN), text);
}

// Services put their error message in slightly different places.
function describeError(body: any): string {
  const message = body?.error?.message ?? body?.error_description ?? body?.error ?? body;
  const text = typeof message === "string" ? message : JSON.stringify(message);
  return text.slice(0, 300);
}
