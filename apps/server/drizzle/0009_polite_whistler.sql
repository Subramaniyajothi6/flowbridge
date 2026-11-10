ALTER TABLE "connections" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "last_checked_at" timestamp with time zone;