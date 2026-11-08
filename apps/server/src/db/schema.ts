import { integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { WorkflowDefinition } from "../engine/definition.ts";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Secret part of the webhook address for this workflow.
  webhookToken: text("webhook_token").notNull().unique(),
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

export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").notNull().references(() => workflowVersions.id),
    status: text("status").$type<RunStatus>().notNull().default("queued"),
    triggerType: text("trigger_type").$type<"manual" | "webhook">().notNull(),
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
