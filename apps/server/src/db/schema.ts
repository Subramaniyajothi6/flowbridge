import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { WorkflowDefinition } from "../engine/definition.ts";
import type { PollConfig, PollCursor, ScheduleConfig } from "../triggers/definition.ts";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Secret part of the webhook address for this workflow.
  webhookToken: text("webhook_token").notNull().unique(),
  // When set, webhook deliveries must be signed with this secret.
  webhookSecret: text("webhook_secret"),
  // The version that new runs use.
  currentVersionId: uuid("current_version_id"),
  createdAt: createdAt(),
});

// A saved copy of a workflow. Rows here are never changed, so a run always
// knows exactly which steps it was started with.
export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    definition: jsonb("definition").$type<WorkflowDefinition>().notNull(),
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
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Sign-ins that have started but not finished.
export const oauthStates = pgTable("oauth_states", {
  state: text("state").primaryKey(),
  connector: text("connector").notNull(),
  name: text("name").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type RunStatus = "queued" | "running" | "succeeded" | "failed";
export type RunTriggerType = "manual" | "webhook" | "schedule" | "poll";

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").notNull().references(() => workflowVersions.id),
    status: text("status").$type<RunStatus>().notNull().default("queued"),
    triggerType: text("trigger_type").$type<RunTriggerType>().notNull(),
    triggerData: jsonb("trigger_data").notNull(),
    // Stops the same webhook delivery from starting two runs.
    idempotencyKey: text("idempotency_key"),
    error: text("error"),
    // Which worker owns this run, and until when.
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.workflowId, table.idempotencyKey)],
);

export type StepStatus = "running" | "succeeded" | "failed" | "skipped";

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
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.runId, table.stepId)],
);
