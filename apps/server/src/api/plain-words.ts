import { getConnector } from "../connectors/registry.ts";
import type { WorkflowDefinition, WorkflowStep } from "../engine/definition.ts";
import { failureReason } from "./failure-reasons.ts";

// Turns technical details into words for people who use workflows but do not build them.

// The details a workflow reads from the data it starts with, such as {{trigger.body.email}}.
// The Run form asks for these, so nobody has to type JSON.
export type InputField = {
  path: string;
  name: string;
  label: string;
  kind: "text" | "long_text" | "email" | "choice";
  options?: string[];
  required: boolean;
  hint?: string;
};

const TRIGGER_REFERENCE = /\{\{\s*trigger\.([A-Za-z_][\w-]*)(?:\.([A-Za-z_][\w-]*))?/g;

// "order_number" reads as "Order number".
function labelFor(name: string): string {
  const words = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Every detail the steps read from the starting data, in the order they first appear.
function detectedFields(definition: WorkflowDefinition): InputField[] {
  const found = new Map<string, InputField>();
  for (const match of JSON.stringify(definition.steps).matchAll(TRIGGER_REFERENCE)) {
    const [, first, second] = match;
    if (first === "body" && !second) continue;
    // Webhook data arrives under "body", so {{trigger.body.email}} is the "email" field inside it.
    const name = first === "body" ? (second as string) : first;
    const path = first === "body" ? `body.${second}` : first;
    if (!found.has(path)) found.set(path, { path, name, label: labelFor(name), kind: name.toLowerCase().includes("email") ? "email" : "text", required: true });
  }
  return [...found.values()];
}

// The questions on the Run now form. The workflow's own form settings come first, in their order.
// A detail the steps use that the settings do not mention yet is added at the end, so it is never missed.
export function inputFieldsOf(definition: WorkflowDefinition | null | undefined): InputField[] {
  if (!definition) return [];
  const detected = detectedFields(definition);
  const configured = (definition.runForm ?? [])
    .filter((field) => detected.some((item) => item.path === field.path))
    .map((field) => ({ ...field, name: field.path.split(".").pop() as string }));
  const configuredPaths = new Set(configured.map((field) => field.path));
  return [...configured, ...detected.filter((field) => !configuredPaths.has(field.path))];
}

// The service a step talks to, in the words a person would use.
export function serviceOf(step: WorkflowStep | undefined): string | null {
  if (!step) return null;
  if (step.type === "connector") return getConnector(step.config.connector)?.name ?? "the connected app";
  if (step.type === "loop") return step.config.action.type === "connector" ? getConnector(step.config.action.config.connector)?.name ?? "the connected app" : "a web service";
  if (step.type === "http_request") return "a web service";
  return null;
}

export type RunForStory = { workflowName: string; status: string; waitKind: string | null; failedStepName: string | null; reason: string | null };

// One sentence about a run, for the "What happened today" list.
export function runSentence(run: RunForStory): { text: string; tone: "ok" | "err" | "warn" | "run" } {
  const name = run.workflowName;
  if (run.status === "succeeded") return { text: `${name} finished.`, tone: "ok" };
  if (run.status === "failed") {
    const where = run.failedStepName ? ` at ${run.failedStepName}` : "";
    const because = run.reason ? `, because ${lowerFirstWord(run.reason).replace(/\.$/, "")}` : "";
    return { text: `${name} stopped${where}${because}.`, tone: "err" };
  }
  if (run.status === "waiting") {
    if (run.waitKind === "approval") return { text: `${name} is waiting for a decision.`, tone: "warn" };
    if (run.waitKind === "retry") return { text: `${name} is trying again after a problem.`, tone: "warn" };
    return { text: `${name} is waiting before its next step.`, tone: "run" };
  }
  return { text: `${name} is running now.`, tone: "run" };
}

// "The Gmail account..." reads as "the Gmail account..." in the middle of a sentence. Names such as "Slack" keep their capital.
function lowerFirstWord(text: string): string {
  return /^(The|A|Something)\b/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

// What went wrong, and whether trying again is likely to help.
export function plainFailure(service: string | null, error: string | null): { text: string; retryHelps: boolean } {
  const who = service ?? "A step";
  switch (failureReason(error)) {
    case "Sending or usage limit reached":
      return { text: `${who} has reached its limit for now.`, retryHelps: true };
    case "Access expired or refused":
      return { text: `The ${service ?? "app"} account needs connecting again.`, retryHelps: false };
    case "Could not find what it needed":
      return { text: `${who} could not find what it needed, such as a channel, sheet or record.`, retryHelps: false };
    case "The service had a server error":
      return { text: `${who} had a problem on its side.`, retryHelps: true };
    case "Took too long to answer":
      return { text: `${who} took too long to answer.`, retryHelps: true };
    case "Data was not accepted":
      return { text: `${who} did not accept the information it was sent.`, retryHelps: false };
    default:
      return { text: "Something went wrong part way through.", retryHelps: true };
  }
}
