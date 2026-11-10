import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { recordActivity } from "../auth/activity.ts";
import { currentUser, requirePermission } from "../auth/sessions.ts";
import { decodeLogo, isValidLogo } from "../connectors/app-logo.ts";
import { getConnector } from "../connectors/registry.ts";
import { db } from "../db/client.ts";
import { appLogos } from "../db/schema.ts";

const idParams = z.object({ id: z.string().min(1) });
const logoBody = z.object({ logo: z.string().refine(isValidLogo, "The logo must be a PNG, JPEG, WebP, GIF or ICO image of at most 100 KB") });

export async function saveLogo(connectorId: string, logo: string): Promise<void> {
  await db
    .insert(appLogos)
    .values({ connectorId, logo })
    .onConflictDoUpdate({ target: appLogos.connectorId, set: { logo, updatedAt: sql`now()` } });
}

export function registerLogoRoutes(app: FastifyInstance): void {
  const adminOnly = { preHandler: requirePermission("apps.manage") };

  // Lists only the apps that have a chosen logo. The version changes with each new logo,
  // so a browser fetches the new picture straight away instead of keeping the old one.
  app.get("/api/logos", async () => {
    const rows = await db.select({ connectorId: appLogos.connectorId, updatedAt: appLogos.updatedAt }).from(appLogos);
    return Object.fromEntries(rows.map((row) => [row.connectorId, `/api/logos/${row.connectorId}?v=${row.updatedAt.getTime()}`]));
  });

  app.get("/api/logos/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [row] = await db.select({ logo: appLogos.logo }).from(appLogos).where(eq(appLogos.connectorId, id));
    const image = row ? decodeLogo(row.logo) : null;
    if (!image) return reply.status(404).send({ error: "No logo" });

    return reply
      .type(image.type)
      // Stops a browser treating the file as anything other than the image it claims to be.
      .header("x-content-type-options", "nosniff")
      .header("content-security-policy", "default-src 'none'; sandbox")
      .header("cache-control", "private, max-age=31536000, immutable")
      .send(image.bytes);
  });

  app.put("/api/logos/:id", adminOnly, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { logo } = logoBody.parse(request.body);
    const connector = getConnector(id);
    if (!connector) return reply.status(404).send({ error: "App not found" });

    await saveLogo(id, logo);
    await recordActivity(currentUser(request).name, `changed the ${connector.name} logo`, "adminOnly");
    return reply.status(204).send();
  });

  // Goes back to the logo that ships with FlowBridge.
  app.delete("/api/logos/:id", adminOnly, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await db.delete(appLogos).where(eq(appLogos.connectorId, id));
    return reply.status(204).send();
  });
}
