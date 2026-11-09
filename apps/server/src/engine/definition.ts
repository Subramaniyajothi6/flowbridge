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
  // Empty while a draft has not been connected yet, for example one made from a template.
  connectionId: z.uuid().or(z.literal("")),
  params: z.record(z.string(), z.unknown()).default({}),
});

const SECONDS_PER_UNIT = { seconds: 1, minutes: 60, hours: 3600, days: 86400 };
const LONGEST_DELAY_SECONDS = 7 * 86400;

const delayConfig = z
  .object({ amount: z.number().int().min(1), unit: z.enum(["seconds", "minutes", "hours", "days"]) })
  .refine((delay) => delay.amount * SECONDS_PER_UNIT[delay.unit] <= LONGEST_DELAY_SECONDS, "A delay can be at most 7 days");

const approvalConfig = z.object({
  message: z.string().min(1),
  // If nobody decides in this time the step fails, which an error path can handle.
  timeoutHours: z.number().int().min(1).max(168),
});

// A loop repeats one action for each item of a list. The action can use {{loop.item}} and {{loop.index}}.
const loopAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("http_request"), config: httpRequestConfig }),
  z.object({ type: z.literal("connector"), config: connectorConfig }),
]);

const loopConfig = z.object({
  // Usually a reference to a list from an earlier step.
  items: z.unknown(),
  action: loopAction,
});

const retryPolicy = z.object({
  // 1 means the step is tried once and never retried.
  maxAttempts: z.number().int().min(1).max(5),
  // The wait before the first retry. It doubles for each retry after that.
  delaySeconds: z.number().int().min(1).max(3600),
});

// Fields every step has. The position is only where the step sits on the canvas.
const stepBase = {
  id: stepId,
  name: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  retry: retryPolicy.optional(),
};

export const stepSchema = z.discriminatedUnion("type", [
  z.object({ ...stepBase, type: z.literal("http_request"), config: httpRequestConfig }),
  z.object({ ...stepBase, type: z.literal("if"), config: ifConfig }),
  z.object({ ...stepBase, type: z.literal("connector"), config: connectorConfig }),
  z.object({ ...stepBase, type: z.literal("delay"), config: delayConfig }),
  z.object({ ...stepBase, type: z.literal("approval"), config: approvalConfig }),
  z.object({ ...stepBase, type: z.literal("loop"), config: loopConfig }),
]);

// An edge says: after step "from", go to step "to".
// "success" is for normal steps. "true" and "false" are the branches of an If step.
// "approved" and "rejected" are the branches of an Approval step.
// "error" can leave any step, and is followed only when that step failed.
const edgeSchema = z.object({
  from: stepId,
  to: stepId,
  when: z.enum(["success", "true", "false", "approved", "rejected", "error"]).default("success"),
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
export type LoopAction = z.infer<typeof loopAction>;

export function delayInSeconds(delay: z.infer<typeof delayConfig>): number {
  return delay.amount * SECONDS_PER_UNIT[delay.unit];
}

// A draft may leave these empty, but nothing can run until every one is chosen.
export function findUnconnectedSteps(definition: WorkflowDefinition): string[] {
  return definition.steps
    .filter((step) => {
      const connectorStep = step.type === "connector" ? step.config : step.type === "loop" && step.config.action.type === "connector" ? step.config.action.config : null;
      return connectorStep !== null && connectorStep.connectionId === "";
    })
    .map((step) => step.name);
}

// The kinds of edge allowed to leave each type of step, besides "error".
function allowedEdges(step: WorkflowStep): string[] {
  if (step.type === "if") return ["true", "false"];
  if (step.type === "approval") return ["approved", "rejected"];
  return ["success"];
}

function findGraphProblems(definition: WorkflowDefinition): string[] {
  const problems: string[] = [];
  const stepsById = new Map<string, WorkflowStep>();

  for (const step of definition.steps) {
    if (stepsById.has(step.id)) problems.push(`Step id "${step.id}" is used more than once`);
    stepsById.set(step.id, step);

    const connectorConfigs = step.type === "connector" ? [step.config] : step.type === "loop" && step.config.action.type === "connector" ? [step.config.action.config] : [];
    for (const { connector, action } of connectorConfigs) {
      if (!getAction(connector, action)) problems.push(`Step "${step.id}" uses unknown action "${connector}.${action}"`);
    }
  }

  for (const edge of definition.edges) {
    const fromStep = stepsById.get(edge.from);
    if (!fromStep) problems.push(`Edge starts at unknown step "${edge.from}"`);
    if (!stepsById.has(edge.to)) problems.push(`Edge ends at unknown step "${edge.to}"`);
    if (!fromStep) continue;

    const allowed = allowedEdges(fromStep);
    if (edge.when !== "error" && !allowed.includes(edge.when)) {
      problems.push(`Edge from step "${edge.from}" must use ${allowed.map((when) => `"${when}"`).join(" or ")}, not "${edge.when}"`);
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
