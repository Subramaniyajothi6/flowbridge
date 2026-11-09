import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.ts";
import { runs, stepRuns, workflows, workflowVersions } from "../db/schema.ts";

const idParams = z.object({ id: z.uuid() });
const listQuery = z.object({
  workflowId: z.uuid().optional(),
  status: z.enum(["queued", "running", "succeeded", "failed"]).optional(),
});

export function registerRunRoutes(app: FastifyInstance): void {
  app.get("/api/runs", async (request) => {
    const { workflowId, status } = listQuery.parse(request.query);
    const filters: SQL[] = [];
    if (workflowId) filters.push(eq(runs.workflowId, workflowId));
    if (status) filters.push(eq(runs.status, status));

    return db
      .select({
        id: runs.id,
        workflowId: runs.workflowId,
        workflowName: workflows.name,
        status: runs.status,
        triggerType: runs.triggerType,
        error: runs.error,
        createdAt: runs.createdAt,
        startedAt: runs.startedAt,
        finishedAt: runs.finishedAt,
      })
      .from(runs)
      .innerJoin(workflows, eq(runs.workflowId, workflows.id))
      .where(and(...filters))
      .orderBy(desc(runs.createdAt))
      .limit(100);
  });

  // Includes the exact version the run used, so that the screen shows the
  // workflow as it was then, even if it has been edited since.
  app.get("/api/runs/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [row] = await db
      .select({ run: runs, workflowName: workflows.name, version: workflowVersions })
      .from(runs)
      .innerJoin(workflows, eq(runs.workflowId, workflows.id))
      .innerJoin(workflowVersions, eq(runs.versionId, workflowVersions.id))
      .where(eq(runs.id, id));
    if (!row) return reply.status(404).send({ error: "Run not found" });

    const steps = await db.select().from(stepRuns).where(eq(stepRuns.runId, id)).orderBy(asc(stepRuns.startedAt));
    return {
      ...row.run,
      workflowName: row.workflowName,
      versionNumber: row.version.versionNumber,
      definition: row.version.definition,
      steps,
    };
  });
}
