// The shapes of the data sent by the server.

export type Position = { x: number; y: number };

type StepBase = { id: string; name: string; position?: Position };

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpConfig = { method: HttpMethod; url: string; headers: Record<string, string>; body?: unknown };

export type IfOperator = "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "exists";
export type IfConfig = { left: unknown; operator: IfOperator; right?: unknown };

export type ConnectorConfig = {
  connector: string;
  action: string;
  connectionId: string;
  params: Record<string, unknown>;
};

export type WorkflowStep =
  | (StepBase & { type: "http_request"; config: HttpConfig })
  | (StepBase & { type: "if"; config: IfConfig })
  | (StepBase & { type: "connector"; config: ConnectorConfig });

export type WorkflowEdge = { from: string; to: string; when: "success" | "true" | "false" };
export type Definition = { steps: WorkflowStep[]; edges: WorkflowEdge[] };

export type RunStatus = "queued" | "running" | "succeeded" | "failed";
export type StepStatus = "running" | "succeeded" | "failed" | "skipped";

export type Workflow = {
  id: string;
  name: string;
  webhookToken: string;
  currentVersionId: string;
  requiresSignature: boolean;
  createdAt: string;
};

export type WorkflowSummary = Workflow & {
  versionNumber: number;
  stepCount: number;
  lastRun: { status: RunStatus; createdAt: string } | null;
};

export type WorkflowVersion = { id: string; versionNumber: number; definition: Definition };
export type WorkflowDetail = Workflow & { versions: WorkflowVersion[] };

export type RunSummary = {
  id: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  triggerType: "manual" | "webhook" | "schedule" | "poll";
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type StepRun = {
  id: string;
  stepId: string;
  status: StepStatus;
  attempt: number;
  input: unknown;
  output: unknown;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type RunDetail = RunSummary & {
  triggerData: unknown;
  versionNumber: number;
  definition: Definition;
  steps: StepRun[];
};

export type Samples = { trigger: unknown; steps: Record<string, { output: unknown }> };

export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  default?: unknown;
  format?: string;
};

export type ConnectorInfo = {
  id: string;
  name: string;
  authType: "token" | "oauth";
  configured: boolean;
  tokenLabel?: string;
  tokenHelp?: string;
  actions: { id: string; description: string; inputSchema: JsonSchema }[];
};

export type Connection = {
  id: string;
  connector: string;
  name: string;
  account: string | null;
  status: "active" | "needs_reconnect";
};

export type ScheduleConfig = { cron: string; timezone: string };
export type PollConfig = {
  url: string;
  connectionId?: string;
  itemsPath: string;
  itemIdField: string;
  intervalSeconds: number;
};

export type Trigger = {
  id: string;
  type: "schedule" | "poll";
  config: ScheduleConfig | PollConfig;
  enabled: boolean;
  nextFireAt: string;
  lastFiredAt: string | null;
  lastError: string | null;
};
