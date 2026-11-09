ALTER TABLE "runs" ADD COLUMN "retry_of_run_id" uuid;--> statement-breakpoint
ALTER TABLE "step_runs" ADD COLUMN "wait_kind" text;--> statement-breakpoint
ALTER TABLE "step_runs" ADD COLUMN "resume_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "step_runs" ADD COLUMN "attempt_log" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_retry_of_run_id_runs_id_fk" FOREIGN KEY ("retry_of_run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "step_runs_status_resume_at_index" ON "step_runs" USING btree ("status","resume_at");