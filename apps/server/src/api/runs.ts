import { asc, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.ts";
import { runs, stepRuns } from "../db/schema.ts";

const idParams = z.object({ id: z.uuid() });

export function registerRunRoutes(app: FastifyInstance): void {
  app.get("/api/runs", async () => {
    return db.select().from(runs).orderBy(desc(runs.createdAt)).limit(100);
  });

  app.get("/api/runs/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const [run] = await db.select().from(runs).where(eq(runs.id, id));
    if (!run) return reply.status(404).send({ error: "Run not found" });

    const steps = await db.select().from(stepRuns).where(eq(stepRuns.runId, id)).orderBy(asc(stepRuns.startedAt));
    return { ...run, steps };
  });
}
