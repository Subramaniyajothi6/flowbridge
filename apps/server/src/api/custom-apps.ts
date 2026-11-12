import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { recordActivity } from "../auth/activity.ts";
import { currentUser, requirePermission } from "../auth/sessions.ts";
import { config } from "../config.ts";
import { findLogo, isValidLogo } from "../connectors/app-logo.ts";
import { customAppSchema, slugify } from "../connectors/custom-app.ts";
import { registerCustomApp } from "../connectors/custom-apps-store.ts";
import { getConnector, unregisterConnector } from "../connectors/registry.ts";
import { db } from "../db/client.ts";
import { appLogos, connections, customApps } from "../db/schema.ts";
import { assertPublicAddress } from "../engine/steps/http-step.ts";
import { saveLogo } from "./logos.ts";

const idParams = z.object({ id: z.string().min(1) });
const logo = z.string().refine(isValidLogo, "The logo must be a PNG, JPEG, WebP, GIF or ICO image of at most 100 KB");
const addAppBody = customAppSchema.and(z.object({ logo: logo.optional() }));

export function registerCustomAppRoutes(app: FastifyInstance): void {
  const adminOnly = { preHandler: requirePermission("apps.manage") };

  app.post("/api/custom-apps", adminOnly, async (request, reply) => {
    const { logo: uploadedLogo, ...definition } = addAppBody.parse(request.body);

    if (!config.ALLOW_PRIVATE_URLS) {
      try {
        await assertPublicAddress(new URL(definition.baseUrl));
      } catch (error) {
        return reply.status(400).send({ error: (error as Error).message });
      }
    }

    // A logo the person chose is always used. Otherwise the app's own site icon is fetched.
    const chosenLogo = uploadedLogo ?? (await findLogo(definition.baseUrl, config.ALLOW_PRIVATE_URLS));

    // The prefix means a custom app can never replace a built-in one such as Slack.
    const id = `app_${slugify(definition.name)}`;
    const [created] = await db
      .insert(customApps)
      .values({ id, definition, createdBy: currentUser(request).name })
      .onConflictDoNothing()
      .returning({ id: customApps.id });
    if (!created) return reply.status(409).send({ error: "An app with that name already exists" });

    if (chosenLogo) await saveLogo(id, chosenLogo);
    registerCustomApp(id, definition);
    await recordActivity(currentUser(request), `added the app ${definition.name}`);
    return reply.status(201).send({ id, hasLogo: chosenLogo !== null });
  });

  app.delete("/api/custom-apps/:id", adminOnly, async (request, reply) => {
    const { id } = idParams.parse(request.params);

    // Its connections hold keys and may be used by workflows, so a person removes those first.
    const inUse = await db.select({ id: connections.id }).from(connections).where(eq(connections.connector, id)).limit(1);
    if (inUse.length > 0) return reply.status(409).send({ error: "Remove this app's connections first" });

    const [deleted] = await db.delete(customApps).where(eq(customApps.id, id)).returning({ id: customApps.id });
    if (!deleted) return reply.status(404).send({ error: "App not found" });
    await db.delete(appLogos).where(eq(appLogos.connectorId, id));

    const name = getConnector(id)?.name ?? id;
    unregisterConnector(id);
    await recordActivity(currentUser(request), `removed the app ${name}`);
    return reply.status(204).send();
  });
}
