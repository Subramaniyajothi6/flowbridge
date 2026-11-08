import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.ts";
import { workflows } from "../db/schema.ts";
import { createRun } from "../engine/create-run.ts";

const params = z.object({ token: z.string().min(1) });

export function registerWebhookRoutes(app: FastifyInstance): void {
  app.post("/hooks/:token", async (request, reply) => {
    const { token } = params.parse(request.params);
    const [workflow] = await db.select().from(workflows).where(eq(workflows.webhookToken, token));
    if (!workflow) return reply.status(404).send({ error: "Webhook not found" });

    const idempotencyKey = request.headers["idempotency-key"];

    // The run is saved before we reply, so an accepted event cannot be lost.
    const { run, isDuplicate } = await createRun({
      workflowId: workflow.id,
      versionId: workflow.currentVersionId as string,
      triggerType: "webhook",
      triggerData: { body: request.body ?? null, query: request.query },
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
    });
    return reply.status(isDuplicate ? 200 : 202).send({ runId: run.id, duplicate: isDuplicate });
  });
}
