import { runConnectorStep } from "../../connections/run-connector.ts";
import type { ConnectorStepConfig, HttpRequestConfig, IfConfig, LoopAction, WorkflowStep } from "../definition.ts";
import { resolveReferences, type ReferenceContext } from "../references.ts";
import { runHttpStep, type HttpStepOptions } from "./http-step.ts";
import { runIfStep } from "./if-step.ts";

// Steps that do their work in one call. Delay, Approval and Loop take more
// than one turn of the engine, so advance-run.ts handles those itself.
export type SingleCallStep = Extract<WorkflowStep, { type: "http_request" | "if" | "connector" }> | LoopAction;

// Fills in the references in a step's settings.
export function resolveStepInput(step: SingleCallStep, context: ReferenceContext): unknown {
  // An If step using "exists" has to be able to look at a value that is not there.
  return resolveReferences(step.config, context, step.type === "if" ? "undefined" : "error");
}

// To add a new single-call step type, add it to definition.ts and add a case here.
export async function runStep(step: SingleCallStep, input: unknown, options: HttpStepOptions): Promise<unknown> {
  switch (step.type) {
    case "http_request":
      return runHttpStep(input as HttpRequestConfig, options);
    case "if":
      return runIfStep(input as IfConfig);
    case "connector":
      return runConnectorStep(input as ConnectorStepConfig, options.idempotencyKey);
  }
}
