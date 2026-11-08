import type { StepStatus } from "../db/schema.ts";
import type { WorkflowDefinition, WorkflowEdge } from "./definition.ts";

export type StepState = { status: StepStatus; output: unknown };

export type NextAction =
  | { type: "run"; stepId: string }
  | { type: "skip"; stepId: string }
  | { type: "finish"; status: "succeeded" | "failed" };

function isFinished(state: StepState | undefined): boolean {
  return state !== undefined && state.status !== "running";
}

function isEdgeFollowed(edge: WorkflowEdge, source: StepState): boolean {
  if (source.status !== "succeeded") return false;
  if (edge.when === "success") return true;
  return String((source.output as { result: boolean }).result) === edge.when;
}

// Looks at what has happened so far and decides the single next thing to do.
// It only reads its inputs, so a run can always be picked up from the saved rows.
export function findNextAction(definition: WorkflowDefinition, states: Map<string, StepState>): NextAction {
  for (const state of states.values()) {
    if (state.status === "failed") return { type: "finish", status: "failed" };
  }

  for (const step of definition.steps) {
    if (isFinished(states.get(step.id))) continue;

    const incoming = definition.edges.filter((edge) => edge.to === step.id);
    if (incoming.length === 0) return { type: "run", stepId: step.id };

    // A step has to wait until every step before it has finished.
    if (!incoming.every((edge) => isFinished(states.get(edge.from)))) continue;

    const anyEdgeFollowed = incoming.some((edge) => isEdgeFollowed(edge, states.get(edge.from) as StepState));
    return { type: anyEdgeFollowed ? "run" : "skip", stepId: step.id };
  }

  return { type: "finish", status: "succeeded" };
}
