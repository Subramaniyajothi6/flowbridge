import { z } from "zod";
import { getAction } from "../connectors/registry.ts";

// Step IDs appear inside references like {{steps.get_user.output.id}},
// so they can only contain letters, numbers and underscores.
const stepId = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Use letters, numbers and underscores, starting with a letter");

const httpRequestConfig = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  // A string, not a URL, because it can contain references.
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.unknown().optional(),
});

const ifConfig = z.object({
  left: z.unknown(),
  operator: z.enum(["equals", "not_equals", "greater_than", "less_than", "contains", "exists"]),
  right: z.unknown().optional(),
});

// Refers to a saved connection by its ID, so a workflow never contains a secret.
const connectorConfig = z.object({
  connector: z.string().min(1),
  action: z.string().min(1),
  connectionId: z.uuid(),
  params: z.record(z.string(), z.unknown()).default({}),
});

// Fields every step has. The position is only where the step sits on the canvas.
const stepBase = {
  id: stepId,
  name: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
};

export const stepSchema = z.discriminatedUnion("type", [
  z.object({ ...stepBase, type: z.literal("http_request"), config: httpRequestConfig }),
  z.object({ ...stepBase, type: z.literal("if"), config: ifConfig }),
  z.object({ ...stepBase, type: z.literal("connector"), config: connectorConfig }),
]);

// An edge says: after step "from", go to step "to".
// "success" is for normal steps. "true" and "false" are for the branches of an If step.
const edgeSchema = z.object({
  from: stepId,
  to: stepId,
  when: z.enum(["success", "true", "false"]).default("success"),
});

export const workflowDefinitionSchema = z
  .object({
    // A new workflow starts empty, so that it can be built on the canvas.
    steps: z.array(stepSchema).max(100),
    edges: z.array(edgeSchema).default([]),
  })
  .superRefine((definition, context) => {
    for (const problem of findGraphProblems(definition)) {
      context.addIssue({ code: "custom", message: problem });
    }
  });

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type WorkflowStep = WorkflowDefinition["steps"][number];
export type WorkflowEdge = WorkflowDefinition["edges"][number];
export type HttpRequestConfig = z.infer<typeof httpRequestConfig>;
export type IfConfig = z.infer<typeof ifConfig>;
export type ConnectorStepConfig = z.infer<typeof connectorConfig>;

function findGraphProblems(definition: WorkflowDefinition): string[] {
  const problems: string[] = [];
  const stepsById = new Map<string, WorkflowStep>();

  for (const step of definition.steps) {
    if (stepsById.has(step.id)) problems.push(`Step id "${step.id}" is used more than once`);
    stepsById.set(step.id, step);

    if (step.type === "connector" && !getAction(step.config.connector, step.config.action)) {
      problems.push(`Step "${step.id}" uses unknown action "${step.config.connector}.${step.config.action}"`);
    }
  }

  for (const edge of definition.edges) {
    const fromStep = stepsById.get(edge.from);
    if (!fromStep) problems.push(`Edge starts at unknown step "${edge.from}"`);
    if (!stepsById.has(edge.to)) problems.push(`Edge ends at unknown step "${edge.to}"`);
    if (!fromStep) continue;

    const isBranchEdge = edge.when === "true" || edge.when === "false";
    if (fromStep.type === "if" && !isBranchEdge) {
      problems.push(`Edge from If step "${edge.from}" must use "true" or "false"`);
    }
    if (fromStep.type !== "if" && isBranchEdge) {
      problems.push(`Only If steps can use "${edge.when}" edges, but "${edge.from}" is not one`);
    }
  }

  if (problems.length === 0 && hasCycle(definition)) {
    problems.push("Workflow steps cannot form a loop");
  }
  return problems;
}

// Repeatedly removes steps that have nothing waiting before them.
// If some steps can never be removed, they are part of a loop.
function hasCycle(definition: WorkflowDefinition): boolean {
  const incomingCount = new Map(definition.steps.map((step) => [step.id, 0]));
  for (const edge of definition.edges) {
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1);
  }

  const ready = definition.steps.filter((step) => incomingCount.get(step.id) === 0).map((step) => step.id);
  let removedCount = 0;

  while (ready.length > 0) {
    const stepId = ready.pop() as string;
    removedCount += 1;
    for (const edge of definition.edges) {
      if (edge.from !== stepId) continue;
      const remaining = (incomingCount.get(edge.to) as number) - 1;
      incomingCount.set(edge.to, remaining);
      if (remaining === 0) ready.push(edge.to);
    }
  }
  return removedCount < definition.steps.length;
}
