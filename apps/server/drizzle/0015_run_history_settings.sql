ALTER TABLE "runs" ADD COLUMN "data_removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "run_history_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "step_retry_attempts" integer DEFAULT 3 NOT NULL;