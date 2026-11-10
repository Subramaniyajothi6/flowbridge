CREATE TABLE "custom_apps" (
	"id" text PRIMARY KEY NOT NULL,
	"definition" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
