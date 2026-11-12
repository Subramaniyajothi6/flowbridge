ALTER TABLE "activity" ADD COLUMN "actor_id" uuid;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "about_user_id" uuid;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "shown_to_all" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_about_user_id_users_id_fk" FOREIGN KEY ("about_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Existing entries: who did it, matched by name, which is safe while every member has a different name.
UPDATE "activity" a SET "actor_id" = u."id" FROM "users" u WHERE a."actor_id" IS NULL AND u."name" = a."actor_name";--> statement-breakpoint
-- Member entries say who they are about in their wording, such as "reset Lena Costa's password".
UPDATE "activity" a SET "about_user_id" = u."id" FROM "users" u
WHERE a."about_user_id" IS NULL AND (
  a."description" = 'reset ' || u."name" || '''s password'
  OR a."description" = 'updated ' || u."name" || '''s access'
  OR a."description" = 'added ' || u."name" || ' to the workspace');--> statement-breakpoint
-- A new published version affects everyone who runs workflows.
UPDATE "activity" SET "shown_to_all" = true WHERE "description" LIKE 'published %, Version %';
