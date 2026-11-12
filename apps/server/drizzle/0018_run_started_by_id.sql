ALTER TABLE "runs" ADD COLUMN "started_by_id" uuid;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_started_by_id_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Existing runs started by a person get their account, matched by name.
UPDATE "runs" r SET "started_by_id" = u."id" FROM "users" u WHERE r."started_by_id" IS NULL AND r."started_by" = u."name";
