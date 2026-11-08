import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../db/client.ts";
import { registerRunRoutes } from "./runs.ts";
import { registerTriggerRoutes } from "./triggers.ts";
import { webhookRoutes } from "./webhooks.ts";
import { registerWorkflowRoutes } from "./workflows.ts";

export function buildServer() {
  const app = Fastify({ logger: { level: "info" } });

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

  app.get("/health", async () => {
    await db.execute(sql`select 1`);
    return { status: "ok" };
  });

  registerWorkflowRoutes(app);
  registerRunRoutes(app);
  registerTriggerRoutes(app);
  app.register(webhookRoutes);
  return app;
}
