CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"event" text NOT NULL,
	"email" boolean NOT NULL,
	"in_app" boolean NOT NULL,
	CONSTRAINT "notification_preferences_user_id_event_pk" PRIMARY KEY("user_id","event")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" text NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"href" text NOT NULL,
	"in_app" boolean NOT NULL,
	"email_status" text DEFAULT 'none' NOT NULL,
	"email_error" text,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_user_id_dedupe_key_unique" UNIQUE("user_id","dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "workflows" ADD COLUMN "created_by_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_index" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_email_status_index" ON "notifications" USING btree ("email_status");--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Existing workflows get an owner from the Activity history ("Jonah Thomas created Jira test").
UPDATE "workflows" w SET "created_by_id" = u."id"
FROM "activity" a JOIN "users" u ON u."name" = a."actor_name"
WHERE w."created_by_id" IS NULL AND a."description" = 'created ' || w."name";--> statement-breakpoint
-- Anything still without an owner is given to the person who last changed it.
UPDATE "workflows" w SET "created_by_id" = u."id"
FROM "users" u
WHERE w."created_by_id" IS NULL AND u."name" = w."updated_by";
