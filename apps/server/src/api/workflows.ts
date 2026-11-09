import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.ts";
import { censorSecrets } from "../connections/censor.ts";
import { encryptSecret } from "../connections/secrets.ts";
import { db } from "../db/client.ts";
import { runs, stepRuns, workflows, workflowVersions } from "../db/schema.ts";
import { createRun } from "../engine/create-run.ts";
import { stepSchema, workflowDefinitionSchema, type WorkflowDefinition } from "../engine/definition.ts";
import type { ReferenceContext } from "../engine/references.ts";
import { resolveStepInput, runStep } from "../engine/steps/run-step.ts";

const idParams = z.object({ id: z.uuid() });
const emptyDefinition: WorkflowDefinition = { steps: [], edges: [] };
const createWorkflowBody = z.object({
  name: z.string().min(1).max(120),
  definition: workflowDefinitionSchema.default(emptyDefinition),
});
const updateWorkflowBody = z.object({ name: z.string().min(1).max(120) });
const createVersionBody = z.object({ definition: workflowDefinitionSchema });
const startRunBody = z.object({ data: z.unknown().default({}) }).default({ data: {} });
const testStepBody = z.object({
  step: stepSchema,
  context: z.object({
    trigger: z.unknown().default({}),
    steps: z.record(z.string(), z.object({ output: z.unknown() })).default({}),
  }),
});

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

  // Adds what the list screen shows: the latest version and the latest run.
  app.get("/api/workflows", async () => {
    const rows = await db.select().from(workflows).orderBy(desc(workflows.createdAt));
    if (rows.length === 0) return [];

    const versionIds = rows.map((row) => row.currentVersionId as string);
    const versions = await db.select().from(workflowVersions).where(inArray(workflowVersions.id, versionIds));
    const latestRuns = await db
      .selectDistinctOn([runs.workflowId], { workflowId: runs.workflowId, status: runs.status, createdAt: runs.createdAt })
      .from(runs)
      .orderBy(runs.workflowId, desc(runs.createdAt));

    return rows.map((row) => {
      const version = versions.find((item) => item.id === row.currentVersionId);
      return {
        ...toPublicWorkflow(row),
        versionNumber: version?.versionNumber ?? 0,
        stepCount: version?.definition.steps.length ?? 0,
        lastRun: latestRuns.find((item) => item.workflowId === row.id) ?? null,
      };
    });
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

  app.patch("/api/workflows/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { name } = updateWorkflowBody.parse(request.body);
    const [updated] = await db.update(workflows).set({ name }).where(eq(workflows.id, id)).returning();
    if (!updated) return reply.status(404).send({ error: "Workflow not found" });
    return toPublicWorkflow(updated);
  });

  app.delete("/api/workflows/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [deleted] = await db.delete(workflows).where(eq(workflows.id, id)).returning({ id: workflows.id });
    if (!deleted) return reply.status(404).send({ error: "Workflow not found" });
    return reply.status(204).send();
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
    const [row] = await db
      .select({ workflow: workflows, version: workflowVersions })
      .from(workflows)
      .innerJoin(workflowVersions, eq(workflows.currentVersionId, workflowVersions.id))
      .where(eq(workflows.id, id));
    if (!row) return reply.status(404).send({ error: "Workflow not found" });
    if (row.version.definition.steps.length === 0) {
      return reply.status(400).send({ error: "Add a step before running this workflow" });
    }

    const { run } = await createRun({
      workflowId: row.workflow.id,
      versionId: row.version.id,
      triggerType: "manual",
      triggerData: body.data,
    });
    return reply.status(202).send(run);
  });

  // The most recent real data for each step, used to offer values in the builder.
  app.get("/api/workflows/:id/samples", async (request) => {
    const { id } = idParams.parse(request.params);
    const [latestRun] = await db
      .select({ triggerData: runs.triggerData })
      .from(runs)
      .where(eq(runs.workflowId, id))
      .orderBy(desc(runs.createdAt))
      .limit(1);

    const latestSteps = await db
      .selectDistinctOn([stepRuns.stepId], { stepId: stepRuns.stepId, output: stepRuns.output })
      .from(stepRuns)
      .innerJoin(runs, eq(stepRuns.runId, runs.id))
      .where(and(eq(runs.workflowId, id), eq(stepRuns.status, "succeeded")))
      .orderBy(stepRuns.stepId, desc(stepRuns.finishedAt));

    return {
      trigger: latestRun?.triggerData ?? null,
      steps: Object.fromEntries(latestSteps.map((row) => [row.stepId, { output: row.output }])),
    };
  });

  // Runs one step on its own, so it can be tried while building.
  // This is a real call: a Slack step really posts its message.
  app.post("/api/workflows/:id/test-step", async (request) => {
    const { step, context } = testStepBody.parse(request.body);
    try {
      const input = resolveStepInput(step, context as ReferenceContext);
      const output = await runStep(step, input, {
        allowPrivateUrls: config.ALLOW_PRIVATE_URLS,
        idempotencyKey: `test:${randomUUID()}`,
      });
      return { ok: true, output: censorSecrets(output) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

// The signing secret must never appear in an API response.
function toPublicWorkflow({ webhookSecret, ...workflow }: typeof workflows.$inferSelect) {
  return { ...workflow, requiresSignature: webhookSecret !== null };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
