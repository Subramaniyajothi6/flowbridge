import { and, asc, count, desc, eq, gte, inArray, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { recordActivity } from "../auth/activity.ts";
import { hasPermission } from "../auth/permissions.ts";
import { currentUser, requirePermission } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import { runs, stepRuns, workflows, workflowVersions } from "../db/schema.ts";
import { findRun, retryFromFailedStep, retryFromStart } from "../engine/retry-run.ts";
import { decideApproval } from "../engine/waits.ts";

const idParams = z.object({ id: z.uuid() });
const stepParams = z.object({ id: z.uuid(), stepId: z.string().min(1) });
const listQuery = z.object({
  workflowId: z.uuid().optional(),
  status: z.enum(["queued", "running", "waiting", "succeeded", "failed"]).optional(),
  mode: z.enum(["live", "test"]).optional(),
  // Only runs started at or after this moment. The browser works it out, so "Today" means the person's own day.
  since: z.iso.datetime({ offset: true }).optional(),
  // Pages are numbered from 1. A larger page is allowed for downloading a CSV.
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(10),
});

type StepProgress = "succeeded" | "failed" | "running" | "waiting" | "skipped" | "not_reached";
const retryBody = z.object({ from: z.enum(["failed", "start"]) });
const decisionBody = z.object({ approved: z.boolean(), note: z.string().max(500).optional() });

type StepRow = typeof stepRuns.$inferSelect;

// A Business User can see that a step ran, but not the data that went through it.
// An approval's message stays, because they may be the person deciding.
function hideStepData(step: StepRow) {
  const isWaitingApproval = step.status === "waiting" && step.waitKind === "approval";
  return { ...step, input: isWaitingApproval ? step.input : null, output: null, attemptLog: [] };
}

export function registerRunRoutes(app: FastifyInstance): void {
  app.get("/api/runs", { preHandler: requirePermission("runs.view") }, async (request) => {
    const { workflowId, status, mode, since, page, pageSize } = listQuery.parse(request.query);
    const filters: SQL[] = [];
    if (workflowId) filters.push(eq(runs.workflowId, workflowId));
    if (status) filters.push(eq(runs.status, status));
    if (mode) filters.push(eq(runs.mode, mode));
    if (since) filters.push(gte(runs.createdAt, new Date(since)));
    const matching = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: runs.id,
          workflowId: runs.workflowId,
          workflowName: workflows.name,
          status: runs.status,
          mode: runs.mode,
          triggerType: runs.triggerType,
          startedBy: runs.startedBy,
          error: runs.error,
          createdAt: runs.createdAt,
          startedAt: runs.startedAt,
          finishedAt: runs.finishedAt,
          versionNumber: workflowVersions.versionNumber,
          definition: workflowVersions.definition,
        })
        .from(runs)
        .innerJoin(workflows, eq(runs.workflowId, workflows.id))
        .innerJoin(workflowVersions, eq(runs.versionId, workflowVersions.id))
        .where(matching)
        // The id keeps runs started at the same moment in one order across pages.
        .orderBy(desc(runs.createdAt), desc(runs.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() }).from(runs).where(matching),
    ]);

    const stepRows = rows.length === 0
      ? []
      : await db.select({ runId: stepRuns.runId, stepId: stepRuns.stepId, status: stepRuns.status }).from(stepRuns).where(inArray(stepRuns.runId, rows.map((row) => row.id)));

    const items = rows.map(({ definition, ...run }) => {
      const statusOf = new Map(stepRows.filter((step) => step.runId === run.id).map((step) => [step.stepId, step.status]));
      // One entry for each step of the version that ran, in order, showing how far the run got.
      const steps: StepProgress[] = definition.steps.map((step) => statusOf.get(step.id) ?? "not_reached");
      const failedStep = definition.steps.find((step) => statusOf.get(step.id) === "failed");
      return { ...run, steps, failedStepName: failedStep?.name ?? null };
    });

    return { items, total, pageSize };
  });

  // Includes the exact version the run used, so that the screen shows the
  // workflow as it was then, even if it has been edited since.
  app.get("/api/runs/:id", { preHandler: requirePermission("runs.view") }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [row] = await db
      .select({ run: runs, workflowName: workflows.name, version: workflowVersions })
      .from(runs)
      .innerJoin(workflows, eq(runs.workflowId, workflows.id))
      .innerJoin(workflowVersions, eq(runs.versionId, workflowVersions.id))
      .where(eq(runs.id, id));
    if (!row) return reply.status(404).send({ error: "Run not found" });

    const steps = await db.select().from(stepRuns).where(eq(stepRuns.runId, id)).orderBy(asc(stepRuns.startedAt));
    const canSeeData = hasPermission(currentUser(request).role, "runs.viewStepData");
    const { definition } = row.version;

    return {
      ...row.run,
      workflowName: row.workflowName,
      versionNumber: row.version.versionNumber,
      triggerData: canSeeData ? row.run.triggerData : null,
      definition: canSeeData ? definition : { steps: definition.steps.map(({ id: stepId, name, type }) => ({ id: stepId, name, type })), edges: [] },
      steps: canSeeData ? steps : steps.map(hideStepData),
    };
  });

  app.post("/api/runs/:id/retry", { preHandler: requirePermission("runs.retry") }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { from } = retryBody.parse(request.body);

    const original = await findRun(id);
    if (!original) return reply.status(404).send({ error: "Run not found" });
    if (original.status !== "failed" && original.status !== "succeeded") {
      return reply.status(409).send({ error: "This run has not finished yet" });
    }
    if (from === "failed" && original.status !== "failed") {
      return reply.status(409).send({ error: "Only a failed run can be retried from its failed step" });
    }

    const person = currentUser(request).name;
    const run = from === "failed" ? await retryFromFailedStep(original, person) : await retryFromStart(original, person);
    return reply.status(202).send(run);
  });

  app.post("/api/runs/:id/steps/:stepId/decision", { preHandler: requirePermission("approvals.decide") }, async (request, reply) => {
    const { id, stepId } = stepParams.parse(request.params);
    const { approved, note } = decisionBody.parse(request.body);
    const person = currentUser(request).name;

    const wasDecided = await decideApproval(id, stepId, { approved, note, decidedBy: person });
    if (!wasDecided) return reply.status(409).send({ error: "This approval has already been decided or has expired" });

    await recordActivity(person, `${approved ? "approved" : "rejected"} a waiting step`);
    return reply.status(204).send();
  });
}
