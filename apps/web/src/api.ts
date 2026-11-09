import type {
  Connection,
  ConnectorInfo,
  Definition,
  RunDetail,
  RunSummary,
  Samples,
  Trigger,
  Workflow,
  WorkflowDetail,
  WorkflowStep,
  WorkflowSummary,
} from "./types.ts";

type ValidationIssue = { message: string };

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = options.body !== undefined;
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: hasBody ? { "content-type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const details = (data?.details as ValidationIssue[] | undefined)?.map((issue) => issue.message).join(". ");
    throw new Error(details || data?.error || "Something went wrong");
  }
  return data as T;
}

export const api = {
  listWorkflows: () => request<WorkflowSummary[]>("/api/workflows"),
  getWorkflow: (id: string) => request<WorkflowDetail>(`/api/workflows/${id}`),
  createWorkflow: (name: string) => request<Workflow>("/api/workflows", { method: "POST", body: { name } }),
  renameWorkflow: (id: string, name: string) => request<Workflow>(`/api/workflows/${id}`, { method: "PATCH", body: { name } }),
  deleteWorkflow: (id: string) => request<void>(`/api/workflows/${id}`, { method: "DELETE" }),
  saveVersion: (id: string, definition: Definition) =>
    request<Workflow>(`/api/workflows/${id}/versions`, { method: "POST", body: { definition } }),
  createWebhookSecret: (id: string) =>
    request<{ webhookSecret: string }>(`/api/workflows/${id}/webhook-secret`, { method: "POST", body: {} }),

  startRun: (workflowId: string, data: unknown) =>
    request<{ id: string }>(`/api/workflows/${workflowId}/runs`, { method: "POST", body: { data } }),
  listRuns: (status?: string) => request<RunSummary[]>(`/api/runs${status ? `?status=${status}` : ""}`),
  getRun: (id: string) => request<RunDetail>(`/api/runs/${id}`),

  getSamples: (workflowId: string) => request<Samples>(`/api/workflows/${workflowId}/samples`),
  testStep: (workflowId: string, step: WorkflowStep, context: { trigger: unknown; steps: Samples["steps"] }) =>
    request<{ ok: boolean; output?: unknown; error?: string }>(`/api/workflows/${workflowId}/test-step`, {
      method: "POST",
      body: { step, context },
    }),

  listTriggers: (workflowId: string) => request<Trigger[]>(`/api/workflows/${workflowId}/triggers`),
  createTrigger: (workflowId: string, body: { type: string; config: unknown }) =>
    request<Trigger>(`/api/workflows/${workflowId}/triggers`, { method: "POST", body }),
  setTriggerEnabled: (id: string, enabled: boolean) =>
    request<Trigger>(`/api/triggers/${id}`, { method: "PATCH", body: { enabled } }),
  deleteTrigger: (id: string) => request<void>(`/api/triggers/${id}`, { method: "DELETE" }),

  listConnectors: () => request<ConnectorInfo[]>("/api/connectors"),
  listConnections: () => request<Connection[]>("/api/connections"),
  createTokenConnection: (connector: string, token: string) =>
    request<{ id: string; account: string }>("/api/connections", { method: "POST", body: { connector, token } }),
  testConnection: (id: string) =>
    request<{ ok: boolean; account?: string; error?: string }>(`/api/connections/${id}/test`, { method: "POST", body: {} }),
  deleteConnection: (id: string) => request<void>(`/api/connections/${id}`, { method: "DELETE" }),
};
