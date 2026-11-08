import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.ts";
import { triggers, workflows } from "../db/schema.ts";
import {
  createTriggerSchema,
  nextCronTime,
  type PollConfig,
  type ScheduleConfig,
} from "../triggers/definition.ts";

const idParams = z.object({ id: z.uuid() });
const updateTriggerBody = z.object({ enabled: z.boolean() });

type Trigger = typeof triggers.$inferSelect;

// The list of seen IDs can be long and is only useful to the engine.
function toPublicTrigger({ cursor, ...trigger }: Trigger) {
  return { ...trigger, hasCheckedOnce: cursor !== null };
}

function firstFireTime(type: Trigger["type"], config: ScheduleConfig | PollConfig): Date {
  const now = new Date();
  // A poll checks straight away, so that it records what already exists.
  return type === "schedule" ? nextCronTime(config as ScheduleConfig, now) : now;
}

export function registerTriggerRoutes(app: FastifyInstance): void {
  app.get("/api/workflows/:id/triggers", async (request) => {
    const { id } = idParams.parse(request.params);
    const rows = await db.select().from(triggers).where(eq(triggers.workflowId, id)).orderBy(desc(triggers.createdAt));
    return rows.map(toPublicTrigger);
  });

  app.post("/api/workflows/:id/triggers", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = createTriggerSchema.parse(request.body);
    const [workflow] = await db.select({ id: workflows.id }).from(workflows).where(eq(workflows.id, id));
    if (!workflow) return reply.status(404).send({ error: "Workflow not found" });

    const [created] = await db
      .insert(triggers)
      .values({ workflowId: id, type: body.type, config: body.config, nextFireAt: firstFireTime(body.type, body.config) })
      .returning();
    return reply.status(201).send(toPublicTrigger(created));
  });

  app.patch("/api/triggers/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { enabled } = updateTriggerBody.parse(request.body);
    const [existing] = await db.select().from(triggers).where(eq(triggers.id, id));
    if (!existing) return reply.status(404).send({ error: "Trigger not found" });

    // Turning a trigger back on starts from now, so time spent off is not treated as missed.
    const [updated] = await db
      .update(triggers)
      .set({ enabled, nextFireAt: enabled ? firstFireTime(existing.type, existing.config) : existing.nextFireAt })
      .where(eq(triggers.id, id))
      .returning();
    return toPublicTrigger(updated);
  });

  app.delete("/api/triggers/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [deleted] = await db.delete(triggers).where(eq(triggers.id, id)).returning({ id: triggers.id });
    if (!deleted) return reply.status(404).send({ error: "Trigger not found" });
    return reply.status(204).send();
  });
}
