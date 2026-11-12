import rateLimit from "@fastify/rate-limit";
import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword, isPasswordCorrect, MINIMUM_PASSWORD_LENGTH, UNKNOWN_USER_HASH } from "../auth/passwords.ts";
import { permissionsFor } from "../auth/permissions.ts";
import { currentUser, endSession, startSession, type SignedInUser } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import { users, workspace } from "../db/schema.ts";
import { notify, peopleWhoCanReceive } from "../notifications/notify.ts";

const email = z.string().trim().toLowerCase().email().max(200);
const newPassword = z.string().min(MINIMUM_PASSWORD_LENGTH, `Use at least ${MINIMUM_PASSWORD_LENGTH} characters`).max(200);

const signInBody = z.object({ email, password: z.string().min(1).max(200) });
const registerBody = z.object({ name: z.string().trim().min(1).max(100), email, organisation: z.string().trim().min(1).max(100), password: newPassword });
const profileBody = z.object({ name: z.string().trim().min(1).max(100), timezone: z.string().min(1).max(60) });
const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(200), newPassword });

// Chosen field by field, so the password hash can never reach a response.
export function toPublicUser(user: SignedInUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastSignInAt: user.lastSignInAt,
    createdAt: user.createdAt,
  };
}

function describeSession(user: SignedInUser, workspaceName: string) {
  return { user: toPublicUser(user), permissions: permissionsFor(user.role), workspaceName };
}

async function getWorkspace() {
  const [row] = await db.select().from(workspace).where(eq(workspace.id, 1));
  return row;
}

export function registerAuthRoutes(app: FastifyInstance): void {
  // Tells the browser whether someone is signed in, and whether the workspace exists yet.
  app.get("/api/auth/status", async (request) => {
    const row = await getWorkspace();
    return { workspaceExists: row !== undefined, session: request.user ? describeSession(request.user, row?.name ?? "") : null };
  });

  // Limited separately, so that passwords cannot be guessed quickly.
  app.register(async (limited) => {
    await limited.register(rateLimit, { max: 10, timeWindow: "1 minute" });

    limited.post("/api/auth/sign-in", async (request, reply) => {
      const body = signInBody.parse(request.body);
      const [user] = await db.select().from(users).where(eq(users.email, body.email));

      const isCorrect = await isPasswordCorrect(body.password, user?.passwordHash ?? UNKNOWN_USER_HASH);
      if (!user || !isCorrect || !user.isActive) {
        return reply.status(401).send({ error: "That email and password do not match" });
      }

      await db.update(users).set({ lastSignInAt: sql`now()` }).where(eq(users.id, user.id));
      await startSession(reply, user.id);

      // A first sign-in is when someone actually joins. Administrators can choose to hear about it.
      if (!user.lastSignInAt) {
        const administrators = (await peopleWhoCanReceive("invite")).filter((person) => person.id !== user.id).map((person) => person.id);
        await notify(administrators, "invite", { title: `${user.name} joined the workspace`, detail: user.email, href: "/team" }, `invite:${user.id}`);
      }
      return describeSession(user, (await getWorkspace())?.name ?? "");
    });

    // Only the very first person can register. Everyone else is added by an Administrator,
    // so a stranger can never register their way into a workspace.
    limited.post("/api/auth/register", async (request, reply) => {
      const body = registerBody.parse(request.body);
      const passwordHash = await hashPassword(body.password);

      const user = await db.transaction(async (tx) => {
        // The single row with a fixed ID means that only one registration can ever succeed.
        const created = await tx.insert(workspace).values({ id: 1, name: body.organisation }).onConflictDoNothing().returning();
        if (created.length === 0) return null;
        const [added] = await tx.insert(users).values({ name: body.name, email: body.email, role: "administrator", passwordHash }).returning();
        return added;
      });

      if (!user) return reply.status(409).send({ error: "This workspace already exists. Ask your Administrator to add you." });
      await startSession(reply, user.id);
      return reply.status(201).send(describeSession(user, body.organisation));
    });
  });

  app.post("/api/auth/sign-out", async (request, reply) => {
    await endSession(request, reply);
    return reply.status(204).send();
  });

  app.patch("/api/auth/me", async (request) => {
    const { name, timezone } = profileBody.parse(request.body);
    const [updated] = await db.update(users).set({ name, timezone }).where(eq(users.id, currentUser(request).id)).returning();
    return toPublicUser(updated);
  });

  app.post("/api/auth/change-password", async (request, reply) => {
    const body = changePasswordBody.parse(request.body);
    const user = currentUser(request);
    if (!(await isPasswordCorrect(body.currentPassword, user.passwordHash))) {
      return reply.status(400).send({ error: "Your current password is not right" });
    }
    await db.update(users).set({ passwordHash: await hashPassword(body.newPassword), mustChangePassword: false }).where(eq(users.id, user.id));
    return reply.status(204).send();
  });
}
