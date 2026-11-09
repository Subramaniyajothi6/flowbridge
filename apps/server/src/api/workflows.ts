import { randomBytes } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { encryptSecret } from "../connections/secrets.ts";
import { db } from "../db/client.ts";
import { workflows, workflowVersions } from "../db/schema.ts";
import { createRun } from "../engine/create-run.ts";
import { workflowDefinitionSchema, type WorkflowDefinition } from "../engine/definition.ts";

const idParams = z.object({ id: z.uuid() });
const createWorkflowBody = z.object({ name: z.string().min(1), definition: workflowDefinitionSchema });
const createVersionBody = z.object({ definition: workflowDefinitionSchema });
const startRunBody = z.object({ data: z.unknown().default({}) }).default({ data: {} });

export function registerWorkflowRoutes(app: FastifyInstance): void {
  app.post("/api/workflows", async (request, reply) => {
    const body = createWorkflowBody.parse(request.body);

    const workflow = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(workflows)
        .values({ name: body.name, webhookToken: randomBytes(24).toString("hex") })
        .returning();
      return addVersion(tx, created.id, body.definition);
    });
    return reply.status(201).send(toPublicWorkflow(workflow));
  });

  app.get("/api/workflows", async () => {
    const rows = await db.select().from(workflows).orderBy(desc(workflows.createdAt));
    return rows.map(toPublicWorkflow);
  });

  // Creates or replaces the signing secret. This is the only time it is shown.
  app.post("/api/workflows/:id/webhook-secret", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const webhookSecret = randomBytes(32).toString("hex");
    const [updated] = await db
      .update(workflows)
      .set({ webhookSecret: encryptSecret(webhookSecret) })
      .where(eq(workflows.id, id))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Workflow not found" });
    return reply.status(201).send({ webhookSecret });
  });

  app.get("/api/workflows/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    if (!workflow) return reply.status(404).send({ error: "Workflow not found" });

    const versions = await db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, id))
      .orderBy(desc(workflowVersions.versionNumber));
    return { ...toPublicWorkflow(workflow), versions };
  });

  // Saving never edits an old version. It always adds a new one.
  app.post("/api/workflows/:id/versions", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = createVersionBody.parse(request.body);
    const [workflow] = await db.select({ id: workflows.id }).from(workflows).where(eq(workflows.id, id));
    if (!workflow) return reply.status(404).send({ error: "Workflow not found" });

    const updated = await db.transaction((tx) => addVersion(tx, id, body.definition));
    return reply.status(201).send(toPublicWorkflow(updated));
  });

  app.post("/api/workflows/:id/runs", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = startRunBody.parse(request.body ?? undefined);
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    if (!workflow) return reply.status(404).send({ error: "Workflow not found" });

    const { run } = await createRun({
      workflowId: workflow.id,
      versionId: workflow.currentVersionId as string,
      triggerType: "manual",
      triggerData: body.data,
    });
    return reply.status(202).send(run);
  });
}

// The signing secret must never appear in an API response.
function toPublicWorkflow({ webhookSecret, ...workflow }: typeof workflows.$inferSelect) {
  return { ...workflow, requiresSignature: webhookSecret !== null };
}

type Transaction =Parameters<Parameters<typeof db.transaction>[0]>[0];

async function addVersion(tx: Transaction, workflowId: string, definition: WorkflowDefinition) {
  // Locks the workflow row, so two saves at once cannot get the same number.
  await tx.select({ id: workflows.id }).from(workflows).where(eq(workflows.id, workflowId)).for("update");

  const [{ nextNumber }] = await tx
    .select({ nextNumber: sql<number>`coalesce(max(${workflowVersions.versionNumber}), 0) + 1` })
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, workflowId));

  const [version] = await tx
    .insert(workflowVersions)
    .values({ workflowId, versionNumber: nextNumber, definition })
    .returning();

  const [workflow] = await tx
    .update(workflows)
    .set({ currentVersionId: version.id })
    .where(eq(workflows.id, workflowId))
    .returning();
  return workflow;
}
