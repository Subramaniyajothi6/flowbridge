import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { recordActivity } from "../auth/activity.ts";
import { hasPermission } from "../auth/permissions.ts";
import { currentUser, requirePermission } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import { workflows, workflowTemplates, workflowVersions } from "../db/schema.ts";
import type { WorkflowDefinition } from "../engine/definition.ts";

const idParams = z.object({ id: z.uuid() });
const createTemplateBody = z.object({
  workflowId: z.uuid(),
  name: z.string().trim().min(1, "Give the template a name").max(120),
  category: z.enum(["Sales", "Finance", "Support", "Operations"]),
  description: z.string().trim().max(300).default(""),
});

// Connections belong to the person who made the workflow. A template keeps every other setting,
// but leaves each app step's account empty for whoever uses it.
export function withoutConnections(definition: WorkflowDefinition): WorkflowDefinition {
  const copy = structuredClone(definition);
  for (const step of copy.steps) {
    if (step.type === "connector") step.config.connectionId = "";
    if (step.type === "loop" && step.config.action.type === "connector") step.config.action.config.connectionId = "";
  }
  return copy;
}

export function registerTemplateRoutes(app: FastifyInstance): void {
  const canEdit = { preHandler: requirePermission("workflows.edit") };

  app.get("/api/templates", canEdit, async () => {
    return db
      .select({
        id: workflowTemplates.id,
        name: workflowTemplates.name,
        category: workflowTemplates.category,
        description: workflowTemplates.description,
        definition: workflowTemplates.definition,
        createdById: workflowTemplates.createdById,
        createdByName: workflowTemplates.createdByName,
        createdAt: workflowTemplates.createdAt,
      })
      .from(workflowTemplates)
      .orderBy(desc(workflowTemplates.createdAt));
  });

  // Made from the workflow's saved draft, or from what is published when there is no draft.
  app.post("/api/templates", canEdit, async (request, reply) => {
    const body = createTemplateBody.parse(request.body);
    const person = currentUser(request);

    const [workflow] = await db
      .select({ draft: workflows.draftDefinition, published: workflowVersions.definition })
      .from(workflows)
      .leftJoin(workflowVersions, eq(workflows.currentVersionId, workflowVersions.id))
      .where(eq(workflows.id, body.workflowId));
    if (!workflow) return reply.status(404).send({ error: "Workflow not found" });

    const definition = workflow.draft ?? workflow.published;
    if (!definition || definition.steps.length === 0) {
      return reply.status(400).send({ error: "This workflow has no steps yet, so there is nothing to save as a template." });
    }

    const [created] = await db
      .insert(workflowTemplates)
      .values({ name: body.name, category: body.category, description: body.description, definition: withoutConnections(definition), createdById: person.id, createdByName: person.name })
      .returning({ id: workflowTemplates.id });
    await recordActivity(person, `saved ${body.name} as a template`);
    return reply.status(201).send(created);
  });

  // The person who made a template, or an Administrator, can remove it.
  app.delete("/api/templates/:id", canEdit, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const person = currentUser(request);

    const [template] = await db.select({ name: workflowTemplates.name, createdById: workflowTemplates.createdById }).from(workflowTemplates).where(eq(workflowTemplates.id, id));
    if (!template) return reply.status(404).send({ error: "Template not found" });
    if (template.createdById !== person.id && !hasPermission(person.role, "members.manage")) {
      return reply.status(403).send({ error: "Only the person who made this template, or an Administrator, can delete it." });
    }

    await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id));
    await recordActivity(person, `deleted the template ${template.name}`);
    return reply.status(204).send();
  });
}
