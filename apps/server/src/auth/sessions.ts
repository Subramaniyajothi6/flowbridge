import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { sessions, users } from "../db/schema.ts";
import { hasPermission, type Permission } from "./permissions.ts";

const COOKIE_NAME = "fb_session";
const SESSION_DAYS = 7;

export type SignedInUser = typeof users.$inferSelect;

declare module "fastify" {
  interface FastifyRequest {
    user: SignedInUser | null;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieHeader(value: string, maxAgeSeconds: number): string {
  const secure = config.PUBLIC_URL?.startsWith("https://") ? "; Secure" : "";
  // HttpOnly hides it from page scripts. SameSite stops other sites from sending it.
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function readToken(request: FastifyRequest): string | null {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [name, value] = part.trim().split("=");
    if (name === COOKIE_NAME && value) return value;
  }
  return null;
}

export async function startSession(reply: FastifyReply, userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await db.delete(sessions).where(lt(sessions.expiresAt, sql`now()`));
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400 * 1000),
  });
  reply.header("set-cookie", cookieHeader(token, SESSION_DAYS * 86400));
}

export async function endSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = readToken(request);
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  reply.header("set-cookie", cookieHeader("", 0));
}

export async function findSignedInUser(request: FastifyRequest): Promise<SignedInUser | null> {
  const token = readToken(request);
  if (!token) return null;

  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, sql`now()`), eq(users.isActive, true)));
  return row?.user ?? null;
}

export function currentUser(request: FastifyRequest): SignedInUser {
  return request.user as SignedInUser;
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!hasPermission(currentUser(request).role, permission)) {
      return reply.status(403).send({ error: "Your role does not allow this" });
    }
  };
}
