import type { HttpRequestConfig, IfConfig, WorkflowStep } from "../definition.ts";
import { resolveReferences, type ReferenceContext } from "../references.ts";
import { runHttpStep, type HttpStepOptions } from "./http-step.ts";
import { runIfStep } from "./if-step.ts";

// Fills in the references in a step's settings.
export function resolveStepInput(step: WorkflowStep, context: ReferenceContext): unknown {
  // An If step using "exists" has to be able to look at a value that is not there.
  return resolveReferences(step.config, context, step.type === "if" ? "undefined" : "error");
}

// To add a new step type, add it to definition.ts and add a case here.
export async function runStep(step: WorkflowStep, input: unknown, options: HttpStepOptions): Promise<unknown> {
  switch (step.type) {
    case "http_request":
      return runHttpStep(input as HttpRequestConfig, options);
    case "if":
      return runIfStep(input as IfConfig);
  }
}
