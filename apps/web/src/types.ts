// The shapes of the data sent by the server.

export type Position = { x: number; y: number };

export type RetryPolicy = { maxAttempts: number; delaySeconds: number };
type StepBase = { id: string; name: string; position?: Position; retry?: RetryPolicy };

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

export type DelayUnit = "seconds" | "minutes" | "hours" | "days";
export type DelayConfig = { amount: number; unit: DelayUnit };
export type ApprovalConfig = { message: string; timeoutHours: number };
export type LoopAction = { type: "http_request"; config: HttpConfig } | { type: "connector"; config: ConnectorConfig };
export type LoopConfig = { items: unknown; action: LoopAction };

export type WorkflowStep =
  | (StepBase & { type: "http_request"; config: HttpConfig })
  | (StepBase & { type: "if"; config: IfConfig })
  | (StepBase & { type: "connector"; config: ConnectorConfig })
  | (StepBase & { type: "delay"; config: DelayConfig })
  | (StepBase & { type: "approval"; config: ApprovalConfig })
  | (StepBase & { type: "loop"; config: LoopConfig });

export type EdgeCondition = "success" | "true" | "false" | "approved" | "rejected" | "error";
export type WorkflowEdge = { from: string; to: string; when: EdgeCondition };
export type Definition = { steps: WorkflowStep[]; edges: WorkflowEdge[] };

export type RunStatus = "queued" | "running" | "waiting" | "succeeded" | "failed";
export type StepStatus = "running" | "waiting" | "succeeded" | "failed" | "skipped";

export type PublicationStatus = "draft" | "published" | "published_with_edits";

export type Workflow = {
  id: string;
  name: string;
  description: string;
  webhookToken: string;
  currentVersionId: string | null;
  requiresSignature: boolean;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
};

export type WorkflowSummary = Omit<Workflow, "webhookToken"> & {
  status: PublicationStatus;
  versionNumber: number | null;
  stepCount: number;
  stepNames: string[];
  // The details the published version reads from its start data, asked for by the Run form.
  inputFields: { path: string; name: string }[];
  lastRun: { status: RunStatus; createdAt: string } | null;
  lastTestRun: { status: RunStatus; createdAt: string } | null;
  last30Days: { total: number; succeeded: number; failed: number };
};

export type WorkflowVersion = { id: string; versionNumber: number; definition: Definition };
export type WorkflowDetail = Workflow & { status: PublicationStatus; draftDefinition: Definition | null; versions: WorkflowVersion[] };

export type RunSummary = {
  id: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  mode: "live" | "test";
  startedBy: string | null;
  triggerType: "manual" | "webhook" | "schedule" | "poll";
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

// How far a run got, one entry for each step of the version that ran.
export type StepProgress = "succeeded" | "failed" | "running" | "waiting" | "skipped" | "not_reached";

export type RunListItem = RunSummary & {
  // Empty for a test run, which used an unpublished copy.
  versionNumber: number | null;
  steps: StepProgress[];
  failedStepName: string | null;
};

export type RunPage = { items: RunListItem[]; total: number; pageSize: number };

export type RunFilters = { status?: string; mode?: string; workflowId?: string; since?: string; page: number; pageSize?: number };

export type StepRun = {
  id: string;
  stepId: string;
  status: StepStatus;
  attempt: number;
  input: unknown;
  output: unknown;
  error: string | null;
  waitKind: "delay" | "approval" | "retry" | null;
  resumeAt: string | null;
  attemptLog: { attempt: number; at: string; error: string; retryInSeconds: number | null }[];
  startedAt: string | null;
  finishedAt: string | null;
};

export type RunDetail = RunSummary & {
  // When the run's data was removed after the workspace's history period, or null.
  dataRemovedAt: string | null;
  retryOfRunId: string | null;
  triggerData: unknown;
  versionNumber: number | null;
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

export type CustomAppAction = {
  name: string;
  method: HttpMethod;
  path: string;
  fields: { name: string; required: boolean }[];
  bodyTemplate?: string;
};

export type CustomAppDraft = {
  name: string;
  baseUrl: string;
  authType: "bearer" | "header" | "basic";
  headerName?: string;
  testPath: string;
  actions: CustomAppAction[];
};

export type ConnectorInfo = {
  id: string;
  name: string;
  authType: "token" | "oauth";
  configured: boolean;
  tokenLabel?: string;
  tokenHelp?: string;
  // Only set for an app added on the Integrations page.
  customHost?: string;
  actions: { id: string; description: string; inputSchema: JsonSchema }[];
};

export type Connection = {
  id: string;
  connector: string;
  name: string;
  account: string | null;
  status: "active" | "needs_reconnect";
  createdBy: string | null;
  createdAt: string;
  lastCheckedAt: string | null;
  // When it stops working on its own, for example a Google connection in Testing status.
  expiresAt: string | null;
  usedBy: { id: string; name: string }[];
};

export type Role = "administrator" | "workflow_builder" | "business_user";

export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  timezone: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

export type Session = { user: Member; permissions: string[]; workspaceName: string };
export type AuthStatus = { workspaceExists: boolean; session: Session | null };
export type Usage = { used: number; limit: number; needsAttention: number };
export type NotificationItem = { id: string; kind: "failed" | "approval" | "retry" | "connection" | "digest" | "review" | "invite"; text: string; detail: string | null; happenedAt: string; href: string };

export type NotificationEvent = "fail" | "digest" | "token" | "review" | "invite";
export type NotificationPreference = { event: NotificationEvent; label: string; description: string; email: boolean; inApp: boolean };
export type NotificationSettings = { emailAddress: string; canReceiveEmail: boolean; events: NotificationPreference[] };
export type Notifications = { items: NotificationItem[]; unread: number };
export type Workspace = {
  id: number;
  name: string;
  monthlyRunLimit: number;
  // 0 keeps run data forever.
  runHistoryDays: number;
  stepRetryAttempts: number;
  // Live runs so far this month, and when that count starts again.
  used: number;
  resetsAt: string;
};

export type RunTotals = { total: number; succeeded: number; failed: number; active: number; average_seconds: number };

export type Overview = {
  workflows: { total: number; published: number; drafts: number };
  runs: RunTotals;
  attention: { id: string; workflow_name: string; status: RunStatus; error: string | null; step_id: string | null; created_at: string; message: unknown }[];
  mostUsed: { id: string; name: string; runs: number }[];
  recent: { id: string; workflow_name: string; status: RunStatus; created_at: string }[];
  activity: ActivityItem[];
};

// The Overview for people who run workflows rather than build them.
export type MyOverview = {
  // What happened to today's live runs, one sentence each. On a quiet day, the latest runs instead.
  story: { id: string; text: string; tone: "ok" | "err" | "warn" | "run"; at: string; startedByYou: boolean }[];
  storyIsToday: boolean;
  approvals: { runId: string; stepId: string; workflowName: string; stepName: string | null; message: string; waitingSince: string; decideBy: string | null }[];
  failures: { id: string; workflowName: string; createdAt: string; stepName: string | null; reason: string; retryHelps: boolean }[];
  failureCount: number;
  myWeek: { succeeded: number; failed: number; active: number };
};

export type TemplateCategory ="Sales" | "Finance" | "Support" | "Operations";

// A template someone in the workspace made from one of their workflows.
export type TeamTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  definition: Definition;
  createdById: string | null;
  createdByName: string;
  createdAt: string;
};

export type AdminTask ={ kind: "connection" | "limit" | "member" | "usage"; title: string; detail: string; action: string; href: string };

export type AdminOverview = {
  members: { total: number; notSignedIn: number };
  connections: { total: number; needAttention: number };
  runs: { used: number; limit: number };
  team: { role: Role; people: { name: string; hasSignedIn: boolean }[] }[];
  tasks: AdminTask[];
};

export type ActivityItem ={ id: string; actorName: string; description: string; createdAt: string };
export type ActivityPage = { items: ActivityItem[]; total: number; pageSize: number };

export type Analytics = {
  days: number;
  totals: RunTotals;
  daily: { day: string; succeeded: number; failed: number; average_seconds: number }[];
  byWorkflow: { id: string; name: string; runs: number; succeeded: number; failed: number; average_seconds: number }[];
  failureReasons: { reason: string; failures: number; example: string | null }[];
  integrationUsage: { app: string; name: string; steps: number }[];
};

export type Health = {
  databaseMilliseconds: number;
  queuedJobs: number;
  waitingRuns: number;
  stuckRuns: number;
  brokenConnections: { id: string; connector: string; account: string | null }[];
  failingTriggers: { id: string; workflow_name: string; type: string; last_error: string }[];
  uptimeSeconds: number;
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
