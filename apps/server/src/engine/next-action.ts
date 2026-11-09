import type { StepStatus } from "../db/schema.ts";
import type { WorkflowDefinition, WorkflowEdge } from "./definition.ts";

export type StepState = { status: StepStatus; output: unknown };

export type NextAction =
  | { type: "run"; stepId: string }
  | { type: "skip"; stepId: string }
  | { type: "wait" }
  | { type: "finish"; status: "succeeded" | "failed" };

function isFinished(state: StepState | undefined): boolean {
  return state !== undefined && state.status !== "running" && state.status !== "waiting";
}

function isEdgeFollowed(edge: WorkflowEdge, source: StepState): boolean {
  if (edge.when === "error") return source.status === "failed";
  if (source.status !== "succeeded") return false;
  if (edge.when === "success") return true;
  if (edge.when === "approved" || edge.when === "rejected") return (source.output as { decision: string }).decision === edge.when;
  return String((source.output as { result: boolean }).result) === edge.when;
}

export function hasErrorPath(definition: WorkflowDefinition, stepId: string): boolean {
  return definition.edges.some((edge) => edge.from === stepId && edge.when === "error");
}

// Looks at what has happened so far and decides the single next thing to do.
// It only reads its inputs, so a run can always be picked up from the saved rows.
export function findNextAction(definition: WorkflowDefinition, states: Map<string, StepState>): NextAction {
  // A failed step stops the run, unless the workflow says what to do about it.
  for (const [stepId, state] of states) {
    if (state.status === "failed" && !hasErrorPath(definition, stepId)) return { type: "finish", status: "failed" };
  }

  let isAnyStepWaiting = false;

  for (const step of definition.steps) {
    const state = states.get(step.id);
    if (state?.status === "waiting") isAnyStepWaiting = true;
    if (state?.status === "waiting" || isFinished(state)) continue;

    const incoming = definition.edges.filter((edge) => edge.to === step.id);
    if (incoming.length === 0) return { type: "run", stepId: step.id };

    // A step has to wait until every step before it has finished.
    if (!incoming.every((edge) => isFinished(states.get(edge.from)))) continue;

    const anyEdgeFollowed = incoming.some((edge) => isEdgeFollowed(edge, states.get(edge.from) as StepState));
    return { type: anyEdgeFollowed ? "run" : "skip", stepId: step.id };
  }

  return isAnyStepWaiting ? { type: "wait" } : { type: "finish", status: "succeeded" };
}
