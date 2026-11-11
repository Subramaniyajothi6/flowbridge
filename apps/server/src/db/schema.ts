import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { CustomAppDefinition } from "../connectors/custom-app.ts";
import type { WorkflowDefinition } from "../engine/definition.ts";
import type { PollConfig, PollCursor, ScheduleConfig } from "../triggers/definition.ts";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export type Role = "administrator" | "workflow_builder" | "business_user";

// There is one workspace per installation, so this table has a single row.
export const workspace = pgTable("workspace", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull(),
  // The most live runs allowed in a calendar month.
  monthlyRunLimit: integer("monthly_run_limit").notNull().default(25000),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Always stored in lower case.
  email: text("email").notNull().unique(),
  role: text("role").$type<Role>().notNull(),
  // A salted scrypt hash. See auth/passwords.ts.
  passwordHash: text("password_hash").notNull(),
  // Set when an Administrator chose the password, until the person changes it.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  // Notifications from before this time count as read.
  notificationsReadAt: timestamp("notifications_read_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Only a hash of the token is stored, so reading this table does not let anyone sign in.
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

// A short record of who did what, shown on the Overview page.
export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorName: text("actor_name").notNull(),
  description: text("description").notNull(),
  // Member, password and workspace changes are only shown to Administrators.
  isAdminOnly: boolean("is_admin_only").notNull().default(false),
  createdAt: createdAt(),
});

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Secret part of the webhook address for this workflow.
  webhookToken: text("webhook_token").notNull().unique(),
  // When set, webhook deliveries must be signed with this secret.
  webhookSecret: text("webhook_secret"),
  // The published version, which is what real runs use. Empty until first published.
  currentVersionId: uuid("current_version_id"),
  // Saved edits that have not been published. Empty when there are none.
  draftDefinition: jsonb("draft_definition").$type<WorkflowDefinition>(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
});

// A saved copy of a workflow. Rows here are never changed, so a run always
// knows exactly which steps it was started with.
export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
    // Empty for the private copy made for a test run, because that was never published.
    versionNumber: integer("version_number"),
    definition: jsonb("definition").$type<WorkflowDefinition>().notNull(),
    publishedBy: text("published_by"),
    createdAt: createdAt(),
  },
  (table) => [unique().on(table.workflowId, table.versionNumber)],
);

// Schedules and polls are stored here so that they survive restarts and the
// host going to sleep. When the app wakes up, anything overdue is still in the table.
export const triggers = pgTable(
  "triggers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
    type: text("type").$type<"schedule" | "poll">().notNull(),
    config: jsonb("config").$type<ScheduleConfig | PollConfig>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    nextFireAt: timestamp("next_fire_at", { withTimezone: true }).notNull(),
    lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
    lastError: text("last_error"),
    // What a poll has already seen. Empty until its first check.
    cursor: jsonb("cursor").$type<PollCursor>(),
    createdAt: createdAt(),
  },
  (table) => [index().on(table.enabled, table.nextFireAt)],
);

export const connections = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  connector: text("connector").notNull(),
  name: text("name").notNull(),
  // The account it belongs to, shown to people so they can tell connections apart.
  account: text("account"),
  // Always encrypted. See connections/crypto.ts.
  encryptedCredentials: text("encrypted_credentials").notNull(),
  status: text("status").$type<"active" | "needs_reconnect">().notNull().default("active"),
  // Who connected it, and when it was last proved to work.
  createdBy: text("created_by"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Apps an Administrator added on the Integrations page. Keys are kept in connections, never here.
export const customApps = pgTable("custom_apps", {
  id: text("id").primaryKey(),
  definition: jsonb("definition").$type<CustomAppDefinition>().notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: createdAt(),
});

// A logo chosen for any app, built-in or custom, as a small image data address.
// A built-in app without a row here shows the logo that ships with FlowBridge.
export const appLogos = pgTable("app_logos", {
  connectorId: text("connector_id").primaryKey(),
  logo: text("logo").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Sign-ins that have started but not finished.
export const oauthStates = pgTable("oauth_states", {
  state: text("state").primaryKey(),
  connector: text("connector").notNull(),
  name: text("name").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type RunStatus = "queued" | "running" | "waiting" | "succeeded" | "failed";
export type RunTriggerType = "manual" | "webhook" | "schedule" | "poll";
export type RunMode = "live" | "test";

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").notNull().references(() => workflowVersions.id),
    status: text("status").$type<RunStatus>().notNull().default("queued"),
    triggerType: text("trigger_type").$type<RunTriggerType>().notNull(),
    // Test runs are left out of statistics and usage, so testing never skews the numbers.
    mode: text("mode").$type<RunMode>().notNull().default("live"),
    // The person who started it, when a person did.
    startedBy: text("started_by"),
    triggerData: jsonb("trigger_data").notNull(),
    // Stops the same webhook delivery from starting two runs.
    idempotencyKey: text("idempotency_key"),
    error: text("error"),
    // Set when this run is a retry of an earlier run.
    retryOfRunId: uuid("retry_of_run_id").references((): AnyPgColumn => runs.id, { onDelete: "set null" }),
    // Which worker owns this run, and until when.
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.workflowId, table.idempotencyKey), index().on(table.mode, table.createdAt)],
);

export type StepStatus = "running" | "waiting" | "succeeded" | "failed" | "skipped";
export type WaitKind = "delay" | "approval" | "retry";
export type AttemptRecord = { attempt: number; at: string; error: string; retryInSeconds: number | null };

// One row for each step of each run. This is what lets a run continue after a
// crash without repeating the steps that already finished.
export const stepRuns = pgTable(
  "step_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    stepId: text("step_id").notNull(),
    status: text("status").$type<StepStatus>().notNull(),
    attempt: integer("attempt").notNull().default(0),
    input: jsonb("input"),
    output: jsonb("output"),
    error: text("error"),
    // What this step is waiting for, and when the wait ends.
    // An approval's end time is when it gives up waiting for a decision.
    waitKind: text("wait_kind").$type<WaitKind>(),
    resumeAt: timestamp("resume_at", { withTimezone: true }),
    // One entry for each failed attempt, so a person can see what happened each time.
    attemptLog: jsonb("attempt_log").$type<AttemptRecord[]>().notNull().default([]),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.runId, table.stepId), index().on(table.status, table.resumeAt)],
);
