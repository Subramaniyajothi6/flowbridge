import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { recordActivity } from "../auth/activity.ts";
import { currentUser, requirePermission } from "../auth/sessions.ts";
import { config } from "../config.ts";
import { censorSecrets } from "../connections/censor.ts";
import { encryptSecret } from "../connections/secrets.ts";
import { db } from "../db/client.ts";
import { runs, stepRuns, workflows, workflowVersions } from "../db/schema.ts";
import { createRun } from "../engine/create-run.ts";
import { findUnconnectedSteps, stepSchema, workflowDefinitionSchema, type WorkflowDefinition } from "../engine/definition.ts";
import { resolveReferences, type ReferenceContext } from "../engine/references.ts";
import { resolveStepInput, runStep } from "../engine/steps/run-step.ts";

const idParams = z.object({ id: z.uuid() });
const emptyDefinition: WorkflowDefinition = { steps: [], edges: [] };
const createWorkflowBody = z.object({
  name: z.string().min(1).max(120),
  definition: workflowDefinitionSchema.default(emptyDefinition),
});
const updateWorkflowBody = z.object({ name: z.string().min(1).max(120) });
const saveDraftBody = z.object({ definition: workflowDefinitionSchema });
const startRunBody = z.object({ data: z.unknown().default({}) }).default({ data: {} });
const testStepBody = z.object({
  step: stepSchema,
  context: z.object({
    trigger: z.unknown().default({}),
    steps: z.record(z.string(), z.object({ output: z.unknown() })).default({}),
  }),
});

export function registerWorkflowRoutes(app: FastifyInstance): void {
  const canEdit = { preHandler: requirePermission("workflows.edit") };

  // A new workflow is a draft. Nothing can start it until it is published.
  app.post("/api/workflows", canEdit, async (request, reply) => {
    const body = createWorkflowBody.parse(request.body);
    const person = currentUser(request).name;

    const [created] = await db
      .insert(workflows)
      .values({ name: body.name, webhookToken: randomBytes(24).toString("hex"), draftDefinition: body.definition, updatedBy: person })
      .returning();
    await recordActivity(person, `created ${body.name}`);
    return reply.status(201).send(toPublicWorkflow(created));
  });

  // Adds what the list screen shows: the status, the published version and the latest live run.
  app.get("/api/workflows", { preHandler: requirePermission("workflows.view") }, async () => {
    const rows = await db.select().from(workflows).orderBy(desc(workflows.updatedAt));
    if (rows.length === 0) return [];

    const versionIds = rows.map((row) => row.currentVersionId).filter((id) => id !== null);
    const versions = versionIds.length > 0 ? await db.select().from(workflowVersions).where(inArray(workflowVersions.id, versionIds)) : [];
    const latestRuns = await db
      .selectDistinctOn([runs.workflowId], { workflowId: runs.workflowId, status: runs.status, createdAt: runs.createdAt })
      .from(runs)
      .where(eq(runs.mode, "live"))
      .orderBy(runs.workflowId, desc(runs.createdAt));

    const usage = await db
      .select({
        workflowId: runs.workflowId,
        total: sql<number>`count(*)::int`,
        succeeded: sql<number>`count(*) filter (where ${runs.status} = 'succeeded')::int`,
        failed: sql<number>`count(*) filter (where ${runs.status} = 'failed')::int`,
      })
      .from(runs)
      .where(and(eq(runs.mode, "live"), gte(runs.createdAt, sql`now() - interval '30 days'`)))
      .groupBy(runs.workflowId);

    return rows.map((row) => {
      const version = versions.find((item) => item.id === row.currentVersionId);
      // The address of the webhook is a secret, so a list open to every role leaves it out.
      const { webhookToken, draftDefinition, ...listed } = toPublicWorkflow(row);
      return {
        ...listed,
        status: publicationStatus(row),
        versionNumber: version?.versionNumber ?? null,
        stepCount: (draftDefinition ?? version?.definition)?.steps.length ?? 0,
        lastRun: latestRuns.find((item) => item.workflowId === row.id) ?? null,
        last30Days: usage.find((item) => item.workflowId === row.id) ?? { total: 0, succeeded: 0, failed: 0 },
      };
    });
  });

  app.get("/api/workflows/:id", { preHandler: requirePermission("builder.view") }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    if (!workflow) return reply.status(404).send({ error: "Workflow not found" });

    const versions = await db
      .select()
      .from(workflowVersions)
      .where(and(eq(workflowVersions.workflowId, id), isNotNull(workflowVersions.versionNumber)))
      .orderBy(desc(workflowVersions.versionNumber));
    return { ...toPublicWorkflow(workflow), status: publicationStatus(workflow), versions };
  });

  app.patch("/api/workflows/:id", canEdit, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { name } = updateWorkflowBody.parse(request.body);
    const [updated] = await db.update(workflows).set({ name, updatedBy: currentUser(request).name, updatedAt: sql`now()` }).where(eq(workflows.id, id)).returning();
    if (!updated) return reply.status(404).send({ error: "Workflow not found" });
    return toPublicWorkflow(updated);
  });

  app.delete("/api/workflows/:id", canEdit, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [deleted] = await db.delete(workflows).where(eq(workflows.id, id)).returning({ name: workflows.name });
    if (!deleted) return reply.status(404).send({ error: "Workflow not found" });
    await recordActivity(currentUser(request).name, `deleted ${deleted.name}`);
    return reply.status(204).send();
  });

  // Creates or replaces the signing secret. This is the only time it is shown.
  app.post("/api/workflows/:id/webhook-secret", canEdit, async (request, reply) => {
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

  // Saved edits stay private until they are published, so real runs are not affected.
  app.put("/api/workflows/:id/draft", canEdit, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { definition } = saveDraftBody.parse(request.body);
    const [updated] = await db
      .update(workflows)
      .set({ draftDefinition: definition, updatedBy: currentUser(request).name, updatedAt: sql`now()` })
      .where(eq(workflows.id, id))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Workflow not found" });
    return { ...toPublicWorkflow(updated), status: publicationStatus(updated) };
  });

  // Publishing never edits an old version. It always adds a new one.
  app.post("/api/workflows/:id/publish", { preHandler: requirePermission("workflows.publish") }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const person = currentUser(request).name;
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    if (!workflow) return reply.status(404).send({ error: "Workflow not found" });
    if (!workflow.draftDefinition) return reply.status(409).send({ error: "There are no changes to publish" });
    if (workflow.draftDefinition.steps.length === 0) return reply.status(400).send({ error: "Add a step before publishing this workflow" });

    const definition = workflow.draftDefinition;
    const unconnected = findUnconnectedSteps(definition);
    if (unconnected.length > 0) return reply.status(400).send({ error: `Choose a connection for: ${unconnected.join(", ")}` });

    const updated = await db.transaction((tx) => addVersion(tx, id, definition, person));

    const [version] = await db.select({ number: workflowVersions.versionNumber }).from(workflowVersions).where(eq(workflowVersions.id, updated.currentVersionId as string));
    await recordActivity(person, `published ${workflow.name}, Version ${version.number}`);
    return reply.status(201).send({ ...toPublicWorkflow(updated), status: publicationStatus(updated), versionNumber: version.number });
  });

  // Runs the saved draft for real, but marked as a test and left out of the statistics.
  // It gets its own private copy, so later edits cannot change what this run did.
  app.post("/api/workflows/:id/test-run", canEdit, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = startRunBody.parse(request.body ?? undefined);
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    if (!workflow) return reply.status(404).send({ error: "Workflow not found" });

    const definition = workflow.draftDefinition ?? (await publishedDefinition(workflow.currentVersionId));
    if (!definition || definition.steps.length === 0) return reply.status(400).send({ error: "Add a step before testing this workflow" });
    const unconnected = findUnconnectedSteps(definition);
    if (unconnected.length > 0) return reply.status(400).send({ error: `Choose a connection for: ${unconnected.join(", ")}` });

    const [snapshot] = await db.insert(workflowVersions).values({ workflowId: id, versionNumber: null, definition }).returning();
    const { run } = await createRun({ workflowId: id, versionId: snapshot.id, triggerType: "manual", triggerData: body.data, mode: "test", startedBy: currentUser(request).name });
    return reply.status(202).send(run);
  });

  app.post("/api/workflows/:id/runs", { preHandler: requirePermission("workflows.run") }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = startRunBody.parse(request.body ?? undefined);
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    if (!workflow) return reply.status(404).send({ error: "Workflow not found" });
    if (!workflow.currentVersionId) return reply.status(409).send({ error: "Publish this workflow before running it" });

    const { run } = await createRun({
      workflowId: workflow.id,
      versionId: workflow.currentVersionId,
      triggerType: "manual",
      triggerData: body.data,
      startedBy: currentUser(request).name,
    });
    return reply.status(202).send(run);
  });

  // The most recent real data for each step, used to offer values in the builder.
  app.get("/api/workflows/:id/samples", { preHandler: requirePermission("builder.view") }, async (request) => {
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
  app.post("/api/workflows/:id/test-step", canEdit, async (request) => {
    const { step, context } = testStepBody.parse(request.body);
    const options = { allowPrivateUrls: config.ALLOW_PRIVATE_URLS, idempotencyKey: `test:${randomUUID()}` };

    if (step.type === "delay" || step.type === "approval") {
      return { ok: true, output: { note: "This step only waits, so there is nothing to test on its own." } };
    }

    try {
      // A test of a loop only tries the first item.
      if (step.type === "loop") {
        const items = resolveReferences(step.config.items, context as ReferenceContext);
        if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "The value given as Items is not a list with something in it" };
        const itemContext = { ...(context as ReferenceContext), loop: { item: items[0], index: 0 } };
        const firstResult = await runStep(step.config.action, resolveStepInput(step.config.action, itemContext), options);
        return { ok: true, output: { itemCount: items.length, firstResult: censorSecrets(firstResult) } };
      }

      const output = await runStep(step, resolveStepInput(step, context as ReferenceContext), options);
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

function publicationStatus(workflow: typeof workflows.$inferSelect): "draft" | "published" | "published_with_edits" {
  if (!workflow.currentVersionId) return "draft";
  return workflow.draftDefinition ? "published_with_edits" : "published";
}

async function publishedDefinition(versionId: string | null): Promise<WorkflowDefinition | null> {
  if (!versionId) return null;
  const [version] = await db.select().from(workflowVersions).where(eq(workflowVersions.id, versionId));
  return version?.definition ?? null;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function addVersion(tx: Transaction, workflowId: string, definition: WorkflowDefinition, publishedBy: string) {
  // Locks the workflow row, so two saves at once cannot get the same number.
  await tx.select({ id: workflows.id }).from(workflows).where(eq(workflows.id, workflowId)).for("update");

  const [{ nextNumber }] = await tx
    .select({ nextNumber: sql<number>`coalesce(max(${workflowVersions.versionNumber}), 0) + 1` })
    .from(workflowVersions)
    .where(eq(workflowVersions.workflowId, workflowId));

  const [version] = await tx
    .insert(workflowVersions)
    .values({ workflowId, versionNumber: nextNumber, definition, publishedBy })
    .returning();

  const [workflow] = await tx
    .update(workflows)
    .set({ currentVersionId: version.id, draftDefinition: null, updatedBy: publishedBy, updatedAt: sql`now()` })
    .where(eq(workflows.id, workflowId))
    .returning();
  return workflow;
}
