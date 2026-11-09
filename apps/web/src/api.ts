import type {
  Analytics,
  AuthStatus,
  Connection,
  ConnectorInfo,
  Definition,
  Health,
  Member,
  Overview,
  PublicationStatus,
  Role,
  RunDetail,
  RunSummary,
  Samples,
  Session,
  Trigger,
  Usage,
  Workflow,
  WorkflowDetail,
  WorkflowStep,
  WorkflowSummary,
  Workspace,
} from "./types.ts";

type ValidationIssue = { message: string };

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = options.body !== undefined;
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: hasBody ? { "content-type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  // The session ended, so the person has to sign in again.
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    window.location.assign("/sign-in");
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const details = (data?.details as ValidationIssue[] | undefined)?.map((issue) => issue.message).join(". ");
    throw new Error(details || data?.error || "Something went wrong");
  }
  return data as T;
}

function query(values: Record<string, string | undefined>): string {
  const filled = Object.entries(values).filter(([, value]) => value) as [string, string][];
  return filled.length > 0 ? `?${new URLSearchParams(filled).toString()}` : "";
}

export const api = {
  authStatus: () => request<AuthStatus>("/api/auth/status"),
  signIn: (email: string, password: string) => request<Session>("/api/auth/sign-in", { method: "POST", body: { email, password } }),
  register: (body: { name: string; email: string; organisation: string; password: string }) => request<Session>("/api/auth/register", { method: "POST", body }),
  signOut: () => request<void>("/api/auth/sign-out", { method: "POST", body: {} }),
  updateProfile: (body: { name: string; timezone: string }) => request<Member>("/api/auth/me", { method: "PATCH", body }),
  changePassword: (currentPassword: string, newPassword: string) => request<void>("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),

  listMembers: () => request<Member[]>("/api/members"),
  addMember: (body: { name: string; email: string; role: Role }) => request<{ member: Member; temporaryPassword: string }>("/api/members", { method: "POST", body }),
  updateMember: (id: string, body: { role?: Role; isActive?: boolean }) => request<Member>(`/api/members/${id}`, { method: "PATCH", body }),
  resetMemberPassword: (id: string) => request<{ temporaryPassword: string }>(`/api/members/${id}/reset-password`, { method: "POST", body: {} }),
  getWorkspace: () => request<Workspace>("/api/workspace"),
  updateWorkspace: (body: { name: string; monthlyRunLimit: number }) => request<Workspace>("/api/workspace", { method: "PATCH", body }),

  usage: () => request<Usage>("/api/monitoring/usage"),
  overview: () => request<Overview>("/api/monitoring/overview"),
  analytics: (days: number) => request<Analytics>(`/api/monitoring/analytics?days=${days}`),
  health: () => request<Health>("/api/monitoring/health"),

  listWorkflows: () => request<WorkflowSummary[]>("/api/workflows"),
  getWorkflow: (id: string) => request<WorkflowDetail>(`/api/workflows/${id}`),
  createWorkflow: (name: string, definition?: Definition) => request<Workflow>("/api/workflows", { method: "POST", body: { name, definition } }),
  renameWorkflow: (id: string, name: string) => request<Workflow>(`/api/workflows/${id}`, { method: "PATCH", body: { name } }),
  deleteWorkflow: (id: string) => request<void>(`/api/workflows/${id}`, { method: "DELETE" }),
  saveDraft: (id: string, definition: Definition) =>
    request<Workflow & { status: PublicationStatus }>(`/api/workflows/${id}/draft`, { method: "PUT", body: { definition } }),
  publish: (id: string) =>
    request<Workflow & { status: PublicationStatus; versionNumber: number }>(`/api/workflows/${id}/publish`, { method: "POST", body: {} }),
  createWebhookSecret: (id: string) =>
    request<{ webhookSecret: string }>(`/api/workflows/${id}/webhook-secret`, { method: "POST", body: {} }),

  startRun: (workflowId: string, data: unknown) =>
    request<{ id: string }>(`/api/workflows/${workflowId}/runs`, { method: "POST", body: { data } }),
  testWorkflow: (workflowId: string, data: unknown) =>
    request<{ id: string }>(`/api/workflows/${workflowId}/test-run`, { method: "POST", body: { data } }),
  listRuns: (status?: string, mode?: string) => request<RunSummary[]>(`/api/runs${query({ status, mode })}`),
  getRun: (id: string) => request<RunDetail>(`/api/runs/${id}`),
  retryRun: (id: string, from: "failed" | "start") => request<{ id: string }>(`/api/runs/${id}/retry`, { method: "POST", body: { from } }),
  decideApproval: (runId: string, stepId: string, approved: boolean, note: string) =>
    request<void>(`/api/runs/${runId}/steps/${stepId}/decision`, { method: "POST", body: { approved, note: note || undefined } }),

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
