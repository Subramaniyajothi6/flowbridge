import type { Edge, Node } from "@xyflow/react";
import { humanize } from "../format.ts";
import type { ConnectorInfo, Definition, StepRun, StepStatus, WorkflowEdge, WorkflowStep } from "../types.ts";

// The server stores steps and edges. The canvas library wants nodes and edges.
// This file converts between the two, so nothing else needs to know the difference.

export const TRIGGER_ID = "__trigger";

export type FlowNodeData = { step?: WorkflowStep; summary?: string };
export type FlowNode = Node<FlowNodeData>;

const COLUMN_WIDTH = 300;
const ROW_HEIGHT = 140;

function makeEdge(source: string, sourceHandle: string, target: string): Edge {
  const isBranch = sourceHandle === "true" || sourceHandle === "false";
  return {
    id: `${source}:${sourceHandle}:${target}`,
    source,
    sourceHandle,
    target,
    label: isBranch ? (sourceHandle === "true" ? "True" : "False") : undefined,
  };
}

export function connectionToEdge(source: string, sourceHandle: string, target: string): Edge {
  return makeEdge(source, sourceHandle, target);
}

// Steps with nothing before them are shown coming out of the trigger.
export function definitionToFlow(definition: Definition, summary: string): { nodes: FlowNode[]; edges: Edge[] } {
  const columns = assignColumns(definition);
  const usedRows = new Map<number, number>();

  const nodes: FlowNode[] = definition.steps.map((step) => {
    const column = columns.get(step.id) ?? 1;
    const row = usedRows.get(column) ?? 0;
    usedRows.set(column, row + 1);
    return {
      id: step.id,
      type: "step",
      position: step.position ?? { x: column * COLUMN_WIDTH, y: row * ROW_HEIGHT },
      data: { step },
    };
  });

  nodes.unshift({ id: TRIGGER_ID, type: "trigger", deletable: false, position: triggerPosition(nodes), data: { summary } });

  const edges = definition.edges.map((edge) => makeEdge(edge.from, edge.when, edge.to));
  for (const step of definition.steps) {
    if (!definition.edges.some((edge) => edge.to === step.id)) edges.push(makeEdge(TRIGGER_ID, "start", step.id));
  }
  return { nodes, edges };
}

function triggerPosition(nodes: FlowNode[]) {
  if (nodes.length === 0) return { x: 0, y: 0 };
  const left = Math.min(...nodes.map((node) => node.position.x));
  const firstRow = nodes.filter((node) => node.position.x === left).map((node) => node.position.y);
  return { x: left - COLUMN_WIDTH, y: Math.min(...firstRow) };
}

// A step's column is one more than the furthest step before it.
function assignColumns(definition: Definition): Map<string, number> {
  const columns = new Map<string, number>(definition.steps.map((step) => [step.id, 1]));
  for (let pass = 0; pass < definition.steps.length; pass += 1) {
    for (const edge of definition.edges) {
      const next = (columns.get(edge.from) ?? 1) + 1;
      if (next > (columns.get(edge.to) ?? 1)) columns.set(edge.to, next);
    }
  }
  return columns;
}

export function flowToDefinition(nodes: FlowNode[], edges: Edge[]): Definition {
  const steps = nodes
    .filter((node) => node.data.step)
    .map((node) => ({ ...(node.data.step as WorkflowStep), position: node.position }));

  const workflowEdges: WorkflowEdge[] = edges
    .filter((edge) => edge.source !== TRIGGER_ID)
    .map((edge) => ({ from: edge.source, to: edge.target, when: edge.sourceHandle as WorkflowEdge["when"] }));

  return { steps, edges: workflowEdges };
}

// Problems the person should fix before saving, in plain words.
export function findProblems(nodes: FlowNode[], edges: Edge[], connectors: ConnectorInfo[]): string[] {
  const problems: string[] = [];

  for (const node of nodes) {
    const step = node.data.step;
    if (!step) continue;

    if (!edges.some((edge) => edge.target === step.id)) problems.push(`"${step.name}" is not connected to anything before it.`);
    if (step.type === "http_request" && !step.config.url.trim()) problems.push(`"${step.name}" needs a URL.`);
    if (step.type === "if" && !edges.some((edge) => edge.source === step.id)) problems.push(`"${step.name}" has no step after it.`);

    if (step.type === "connector") {
      if (!step.config.connectionId) problems.push(`"${step.name}" needs a connection.`);
      const action = connectors.find((item) => item.id === step.config.connector)?.actions.find((item) => item.id === step.config.action);
      for (const field of action?.inputSchema.required ?? []) {
        const value = step.config.params[field];
        if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
          problems.push(`"${step.name}" needs a value for ${humanize(field).toLowerCase()}.`);
        }
      }
    }
  }
  return problems;
}

// Every step that runs before this one. Only their data can be used by it.
export function stepsBefore(stepId: string, edges: Edge[]): string[] {
  const found = new Set<string>();
  const toVisit = [stepId];

  while (toVisit.length > 0) {
    const current = toVisit.pop() as string;
    for (const edge of edges) {
      if (edge.target === current && edge.source !== TRIGGER_ID && !found.has(edge.source)) {
        found.add(edge.source);
        toVisit.push(edge.source);
      }
    }
  }
  return [...found];
}

// Connecting these two would create a loop if the target can already reach the source.
export function wouldCreateLoop(source: string, target: string, edges: Edge[]): boolean {
  return source === target || stepsBefore(source, edges).includes(target);
}

export function uniqueStepId(base: string, nodes: FlowNode[]): string {
  const taken = new Set(nodes.map((node) => node.id));
  if (!taken.has(base)) return base;
  let number = 2;
  while (taken.has(`${base}_${number}`)) number += 1;
  return `${base}_${number}`;
}

export function statusMap(steps: StepRun[]): Map<string, StepStatus> {
  return new Map(steps.map((step) => [step.stepId, step.status]));
}

export type PickerItem = { path: string; preview: string };

// Lists the values inside a sample, so a person can click one instead of typing its path.
export function listSampleValues(value: unknown, prefix: string, depth = 0): PickerItem[] {
  if (value === null || typeof value !== "object") {
    return [{ path: prefix, preview: String(value).slice(0, 40) }];
  }
  if (depth >= 4) return [];

  // Long lists would drown out everything else, so only the first item is offered.
  const entries: [string, unknown][] = Array.isArray(value) ? value.slice(0, 1).map((item, index) => [String(index), item]) : Object.entries(value);

  return entries
    .filter(([key]) => /^[\w-]+$/.test(key))
    .flatMap(([key, item]) => listSampleValues(item, `${prefix}.${key}`, depth + 1))
    .slice(0, 60);
}
