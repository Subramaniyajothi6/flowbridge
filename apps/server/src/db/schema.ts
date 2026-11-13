import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
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
  // After this many days, the data that went through a finished run is removed. 0 keeps it forever.
  runHistoryDays: integer("run_history_days").notNull().default(90),
  // How many times a new HTTP, app or loop step tries before failing. 1 means it does not retry.
  stepRetryAttempts: integer("step_retry_attempts").notNull().default(3),
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
export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorName: text("actor_name").notNull(),
    description: text("description").notNull(),
    // Member, password and workspace changes are only shown to Administrators, and to the member concerned.
    isAdminOnly: boolean("is_admin_only").notNull().default(false),
    // Who did it, and which member it is about, so each person can be shown their own history.
    actorId: uuid("actor_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    aboutUserId: uuid("about_user_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    // Shown to Business Users too, because it changes a workflow they may run.
    shownToAll: boolean("shown_to_all").notNull().default(false),
    createdAt: createdAt(),
  },
  // The history is read newest first, one page at a time.
  (table) => [index().on(table.createdAt, table.id)],
);

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // A sentence about what it does, shown on the workflow cards. Empty when none was given.
  description: text("description").notNull().default(""),
  // Secret part of the webhook address for this workflow.
  webhookToken: text("webhook_token").notNull().unique(),
  // When set, webhook deliveries must be signed with this secret.
  webhookSecret: text("webhook_secret"),
  // The published version, which is what real runs use. Empty until first published.
  currentVersionId: uuid("current_version_id"),
  // Saved edits that have not been published. Empty when there are none.
  draftDefinition: jsonb("draft_definition").$type<WorkflowDefinition>(),
  // The person who created it. They are told when it fails or when someone else changes it.
  createdById: uuid("created_by_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
});

// What each person wants to be told about, and where. A missing row means the default in notifications/events.ts.
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    event: text("event").$type<NotificationEvent>().notNull(),
    email: boolean("email").notNull(),
    inApp: boolean("in_app").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.event] })],
);

export type NotificationEvent = "fail" | "digest" | "token" | "review" | "invite";
// "sending" means one copy of the app has claimed the email and is sending it.
export type EmailStatus = "none" | "pending" | "sending" | "sent" | "failed";

// Notifications already decided for a person: shown in the bell when in_app is set, and emailed when email_status is pending.
// The key stops the same thing being sent twice, for example when the failure check runs again a minute later.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    event: text("event").$type<NotificationEvent>().notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    href: text("href").notNull(),
    inApp: boolean("in_app").notNull(),
    emailStatus: text("email_status").$type<EmailStatus>().notNull().default("none"),
    emailError: text("email_error"),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique().on(table.userId, table.dedupeKey), index().on(table.userId, table.createdAt), index().on(table.emailStatus)],
);

// Templates made by people in this workspace from one of their workflows.
// The ready-made templates that ship with FlowBridge are in the web app's code instead.
export const workflowTemplates = pgTable("workflow_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").$type<TemplateCategory>().notNull(),
  description: text("description").notNull().default(""),
  // Saved without any connection, so whoever uses it chooses their own accounts.
  definition: jsonb("definition").$type<WorkflowDefinition>().notNull(),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdByName: text("created_by_name").notNull(),
  createdAt: createdAt(),
});

export type TemplateCategory = "Sales" | "Finance" | "Support" | "Operations";

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
    startedById: uuid("started_by_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
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
    // Set when the data that went through this run was removed after the workspace's history period.
    // The run's status, error and timing stay, so Analytics still counts it.
    dataRemovedAt: timestamp("data_removed_at", { withTimezone: true }),
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
