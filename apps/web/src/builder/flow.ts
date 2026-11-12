import type { Edge, Node } from "@xyflow/react";
import { humanize } from "../format.ts";
import type { ConnectorConfig, ConnectorInfo, Definition, RunFormField, StepRun, StepStatus, WorkflowEdge, WorkflowStep } from "../types.ts";

// The server stores steps and edges. The canvas library wants nodes and edges.
// This file converts between the two, so nothing else needs to know the difference.

export const TRIGGER_ID = "__trigger";

export type FlowNodeData = { step?: WorkflowStep; summary?: string };
export type FlowNode = Node<FlowNodeData>;

const COLUMN_WIDTH = 300;
const ROW_HEIGHT = 140;

// True, False, Approved and Rejected are already written beside their dots on the step.
const EDGE_LABELS: Record<string, string> = { error: "On error" };

function makeEdge(source: string, sourceHandle: string, target: string): Edge {
  const edge: Edge = {
    id: `${source}:${sourceHandle}:${target}`,
    source,
    sourceHandle,
    target,
    label: EDGE_LABELS[sourceHandle],
  };
  // An error path is drawn red, dashed and below the cards. See edges.tsx.
  return sourceHandle === "error" ? { ...edge, className: "is-error-edge" } : edge;
}

// The dot a new step's first connection leaves from.
export function firstHandleOf(step: WorkflowStep): string {
  if (step.type === "if") return "true";
  if (step.type === "approval") return "approved";
  return "success";
}

// Puts every step in a column one further than the steps before it, and stacks each column,
// keeping the steps in the order they were from top to bottom.
export function tidyLayout(nodes: FlowNode[], edges: Edge[]): FlowNode[] {
  const columns = new Map(nodes.map((node) => [node.id, node.id === TRIGGER_ID ? 0 : 1]));
  for (let pass = 0; pass < nodes.length; pass += 1) {
    for (const edge of edges) {
      const next = (columns.get(edge.source) ?? 0) + 1;
      if (next > (columns.get(edge.target) ?? 1)) columns.set(edge.target, next);
    }
  }

  const rowsUsed = new Map<number, number>();
  const rowOf = new Map<string, number>();
  for (const node of [...nodes].sort((first, second) => first.position.y - second.position.y)) {
    const column = columns.get(node.id) ?? 1;
    const row = rowsUsed.get(column) ?? 0;
    rowsUsed.set(column, row + 1);
    rowOf.set(node.id, row);
  }

  return nodes.map((node) => ({ ...node, position: { x: (columns.get(node.id) ?? 1) * COLUMN_WIDTH, y: (rowOf.get(node.id) ?? 0) * ROW_HEIGHT } }));
}

const TRIGGER_REFERENCE = /\{\{\s*trigger\.([A-Za-z_][\w-]*)(?:\.([A-Za-z_][\w-]*))?/g;

// The Run now form for these steps: the saved settings first, in their order, then any detail
// the steps use that the settings do not mention yet. The server works this out the same way.
export function runFormFor(steps: WorkflowStep[], saved: RunFormField[] = []): RunFormField[] {
  const detected = new Map<string, RunFormField>();
  for (const match of JSON.stringify(steps).matchAll(TRIGGER_REFERENCE)) {
    const [, first, second] = match;
    if (first === "body" && !second) continue;
    const name = first === "body" ? (second as string) : first;
    const path = first === "body" ? `body.${second}` : first;
    if (!detected.has(path)) detected.set(path, { path, label: humanize(name), kind: name.toLowerCase().includes("email") ? "email" : "text", required: true });
  }
  const kept = saved.filter((field) => detected.has(field.path));
  const keptPaths = new Set(kept.map((field) => field.path));
  return [...kept, ...[...detected.values()].filter((field) => !keptPaths.has(field.path))];
}

// Where a step inserted into a connection goes: one column after the step before it,
// level with the step after it. If that leaves no room, the step after it and everything
// that follows move right, so no cards end up on top of each other.
export function makeRoomForInsert(nodes: FlowNode[], edges: Edge[], fromId: string, toId: string): { nodes: FlowNode[]; position: { x: number; y: number } } {
  const from = nodes.find((node) => node.id === fromId);
  const to = nodes.find((node) => node.id === toId);
  if (!from || !to) return { nodes, position: { x: 0, y: 0 } };

  const position = { x: from.position.x + COLUMN_WIDTH, y: to.position.y };
  const shortBy = position.x + COLUMN_WIDTH - to.position.x;
  if (shortBy <= 0) return { nodes, position };

  const toMove = new Set([toId]);
  for (let added = true; added; ) {
    added = false;
    for (const edge of edges) {
      if (toMove.has(edge.source) && !toMove.has(edge.target) && edge.target !== fromId) {
        toMove.add(edge.target);
        added = true;
      }
    }
  }

  const moved = nodes.map((node) => (toMove.has(node.id) ? { ...node, position: { x: node.position.x + shortBy, y: node.position.y } } : node));
  return { nodes: moved, position };
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
    if ((step.type === "if" || step.type === "approval") && !edges.some((edge) => edge.source === step.id)) problems.push(`"${step.name}" has no step after it.`);
    if (step.type === "approval" && !step.config.message.trim()) problems.push(`"${step.name}" needs a message for the person deciding.`);
    if (step.type === "delay" && !(step.config.amount >= 1)) problems.push(`"${step.name}" needs a wait of at least 1.`);
    if (step.type === "connector") problems.push(...findConnectorProblems(step.name, step.config, connectors));

    if (step.type === "loop") {
      if (!String(step.config.items ?? "").trim()) problems.push(`"${step.name}" needs a list to go through.`);
      const action = step.config.action;
      if (action.type === "http_request" && !action.config.url.trim()) problems.push(`"${step.name}" needs a URL.`);
      if (action.type === "connector") problems.push(...findConnectorProblems(step.name, action.config, connectors));
    }
  }
  return problems;
}

function findConnectorProblems(stepName: string, config: ConnectorConfig, connectors: ConnectorInfo[]): string[] {
  const problems: string[] = [];
  if (!config.connectionId) problems.push(`"${stepName}" needs a connection.`);
  const action = connectors.find((item) => item.id === config.connector)?.actions.find((item) => item.id === config.action);
  for (const field of action?.inputSchema.required ?? []) {
    const value = config.params[field];
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      problems.push(`"${stepName}" needs a value for ${humanize(field).toLowerCase()}.`);
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
