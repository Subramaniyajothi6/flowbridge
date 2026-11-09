import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";
import { findSignedInUser } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import { registerAuthRoutes } from "./auth.ts";
import { registerConnectionRoutes } from "./connections.ts";
import { registerMemberRoutes } from "./members.ts";
import { registerMonitoringRoutes } from "./monitoring.ts";
import { registerWebApp } from "./web-app.ts";
import { registerRunRoutes } from "./runs.ts";
import { registerTriggerRoutes } from "./triggers.ts";
import { webhookRoutes } from "./webhooks.ts";
import { registerWorkflowRoutes } from "./workflows.ts";

// Everything else under /api needs someone to be signed in.
// The OAuth callback proves itself with its one-time state value instead.
const PUBLIC_API_PATHS = ["/api/auth/status", "/api/auth/sign-in", "/api/auth/register", "/api/connections/oauth/callback"];

export function buildServer() {
  const app = Fastify({
    // A free host puts a proxy in front of the app, and this reads the visitor's real address from it.
    trustProxy: true,
    logger: {
      level: "info",
      serializers: {
        // Addresses can carry secrets: sign-in codes in the query, and tokens in webhook paths.
        req: (request) => ({
          method: request.method,
          url: (request.url ?? "").split("?")[0].replace(/^\/hooks\/.*/, "/hooks/[hidden]"),
        }),
      },
    },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: "Invalid request", details: error.issues });
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.status(statusCode).send({ error: (error as Error).message });
    }
    request.log.error(error);
    return reply.status(500).send({ error: "Something went wrong" });
  });

  app.decorateRequest("user", null);

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (!path.startsWith("/api/")) return;

    request.user = await findSignedInUser(request);
    if (!request.user && !PUBLIC_API_PATHS.includes(path)) {
      return reply.status(401).send({ error: "Please sign in" });
    }
  });

  app.get("/health", async () => {
    await db.execute(sql`select 1`);
    return { status: "ok" };
  });

  registerAuthRoutes(app);
  registerMemberRoutes(app);
  registerMonitoringRoutes(app);
  registerWorkflowRoutes(app);
  registerRunRoutes(app);
  registerTriggerRoutes(app);
  registerConnectionRoutes(app);
  registerWebApp(app);
  app.register(webhookRoutes);
  return app;
}
