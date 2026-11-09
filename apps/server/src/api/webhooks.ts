import rateLimit from "@fastify/rate-limit";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.ts";
import { decryptSecret } from "../connections/secrets.ts";
import { db } from "../db/client.ts";
import { workflows } from "../db/schema.ts";
import { createRun } from "../engine/create-run.ts";
import {
  findDeliveryId,
  isSignatureValid,
  parseWebhookBody,
  removeSensitiveHeaders,
  SIGNATURE_HEADER,
} from "./webhook-security.ts";

const params = z.object({ token: z.string().min(1) });
const MAX_BODY_BYTES = 256 * 1024;

// Registered as a separate plugin so that these body and rate limit rules
// apply only to webhooks, and not to the rest of the API.
export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Signatures are calculated over the exact bytes received, so the body is kept unparsed at first.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: MAX_BODY_BYTES }, (_request, body, done) => {
    done(null, body);
  });

  await app.register(rateLimit, {
    max: config.WEBHOOK_MAX_PER_MINUTE,
    timeWindow: "1 minute",
    keyGenerator: (request) => (request.params as { token?: string }).token ?? request.ip,
  });

  app.post("/hooks/:token", async (request, reply) => {
    const { token } = params.parse(request.params);
    const [workflow] = await db.select().from(workflows).where(eq(workflows.webhookToken, token));
    if (!workflow) return reply.status(404).send({ error: "Webhook not found" });

    const rawBody = request.body as Buffer | undefined;

    if (workflow.webhookSecret) {
      const signature = request.headers[SIGNATURE_HEADER];
      if (!isSignatureValid(rawBody ?? Buffer.alloc(0), decryptSecret(workflow.webhookSecret), signature)) {
        return reply.status(401).send({ error: "The signature is missing or wrong" });
      }
    }

    let body: unknown;
    let idempotencyKey: string | undefined;
    try {
      body = parseWebhookBody(rawBody, request.headers["content-type"]);
      idempotencyKey = findDeliveryId(request.headers);
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }

    // The run is saved before we reply, so an accepted event cannot be lost.
    const { run, isDuplicate } = await createRun({
      workflowId: workflow.id,
      versionId: workflow.currentVersionId as string,
      triggerType: "webhook",
      triggerData: { body, query: request.query, headers: removeSensitiveHeaders(request.headers) },
      idempotencyKey,
    });
    return reply.status(isDuplicate ? 200 : 202).send({ runId: run.id, duplicate: isDuplicate });
  });
}
