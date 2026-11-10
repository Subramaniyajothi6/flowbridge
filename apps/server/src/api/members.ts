import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { recordActivity } from "../auth/activity.ts";
import { generateTemporaryPassword, hashPassword } from "../auth/passwords.ts";
import { currentUser, requirePermission } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import { sessions, users, workspace } from "../db/schema.ts";
import { toPublicUser } from "./auth.ts";

const idParams = z.object({ id: z.uuid() });
const role = z.enum(["administrator", "workflow_creator", "business_user", "technical_operator"]);
const addMemberBody = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().email().max(200), role });
const updateMemberBody = z.object({ role: role.optional(), isActive: z.boolean().optional() });
const workspaceBody = z.object({ name: z.string().trim().min(1).max(100), monthlyRunLimit: z.number().int().min(1).max(1_000_000) });

async function isLastActiveAdministrator(userId: string): Promise<boolean> {
  const others = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "administrator"), eq(users.isActive, true), ne(users.id, userId)))
    .limit(1);
  return others.length === 0;
}

export function registerMemberRoutes(app: FastifyInstance): void {
  const adminOnly = { preHandler: requirePermission("members.manage") };

  app.get("/api/members", adminOnly, async () => {
    const rows = await db.select().from(users).orderBy(asc(users.name));
    return rows.map(toPublicUser);
  });

  // There is no email service, so the Administrator passes this password on. It is only shown once.
  app.post("/api/members", adminOnly, async (request, reply) => {
    const body = addMemberBody.parse(request.body);
    const temporaryPassword = generateTemporaryPassword();

    const [created] = await db
      .insert(users)
      .values({ ...body, passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (!created) return reply.status(409).send({ error: "Someone with that email is already a member" });

    await recordActivity(currentUser(request).name, `added ${created.name} to the workspace`, "adminOnly");
    return reply.status(201).send({ member: toPublicUser(created), temporaryPassword });
  });

  app.patch("/api/members/:id", adminOnly, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const changes = updateMemberBody.parse(request.body);

    const removesAdministrator = changes.isActive === false || (changes.role !== undefined && changes.role !== "administrator");
    if (removesAdministrator) {
      const [member] = await db.select().from(users).where(eq(users.id, id));
      if (member?.role === "administrator" && (await isLastActiveAdministrator(id))) {
        return reply.status(409).send({ error: "A workspace needs at least one active Administrator" });
      }
    }

    const [updated] = await db.update(users).set(changes).where(eq(users.id, id)).returning();
    if (!updated) return reply.status(404).send({ error: "Member not found" });

    // A deactivated person is signed out straight away.
    if (changes.isActive === false) await db.delete(sessions).where(eq(sessions.userId, id));
    await recordActivity(currentUser(request).name, `updated ${updated.name}'s access`, "adminOnly");
    return toPublicUser(updated);
  });

  app.post("/api/members/:id/reset-password", adminOnly, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const temporaryPassword = generateTemporaryPassword();

    const [updated] = await db
      .update(users)
      .set({ passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true })
      .where(eq(users.id, id))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Member not found" });

    await db.delete(sessions).where(eq(sessions.userId, id));
    await recordActivity(currentUser(request).name, `reset ${updated.name}'s password`, "adminOnly");
    return { temporaryPassword };
  });

  app.get("/api/workspace", { preHandler: requirePermission("settings.manage") }, async () => {
    const [row] = await db.select().from(workspace).where(eq(workspace.id, 1));
    return row;
  });

  app.patch("/api/workspace", { preHandler: requirePermission("settings.manage") }, async (request) => {
    const body = workspaceBody.parse(request.body);
    const [updated] = await db.update(workspace).set(body).where(eq(workspace.id, sql`1`)).returning();
    await recordActivity(currentUser(request).name, "changed the workspace settings", "adminOnly");
    return updated;
  });
}
