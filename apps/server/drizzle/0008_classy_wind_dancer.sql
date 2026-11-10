CREATE TABLE "app_logos" (
	"connector_id" text PRIMARY KEY NOT NULL,
	"logo" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "app_logos" ("connector_id", "logo") SELECT "id", "logo" FROM "custom_apps" WHERE "logo" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_apps" DROP COLUMN "logo";