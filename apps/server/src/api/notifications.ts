import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hasPermission } from "../auth/permissions.ts";
import { currentUser } from "../auth/sessions.ts";
import { db } from "../db/client.ts";
import { notificationPreferences } from "../db/schema.ts";
import { canReceiveEmail, defaultPreference, NOTIFICATION_EVENTS } from "../notifications/events.ts";

const preferenceBody = z.object({
  event: z.enum(["fail", "digest", "token", "review", "invite"]),
  email: z.boolean(),
  inApp: z.boolean(),
});

// Each person chooses for themselves, so these need no special permission.
export function registerNotificationRoutes(app: FastifyInstance): void {
  // Only the rows that apply to this person's role, with their current choices.
  app.get("/api/notifications/preferences", async (request) => {
    const user = currentUser(request);
    const saved = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, user.id));

    return {
      emailAddress: user.email,
      canReceiveEmail: canReceiveEmail(user.email),
      events: NOTIFICATION_EVENTS.filter((item) => hasPermission(user.role, item.who)).map((item) => {
        const choice = saved.find((row) => row.event === item.event) ?? defaultPreference(item.event);
        return { event: item.event, label: item.label, description: item.description, email: choice.email, inApp: choice.inApp };
      }),
    };
  });

  app.put("/api/notifications/preferences", async (request, reply) => {
    const user = currentUser(request);
    const body = preferenceBody.parse(request.body);
    const event = NOTIFICATION_EVENTS.find((item) => item.event === body.event);
    if (!event || !hasPermission(user.role, event.who)) return reply.status(403).send({ error: "This notification does not apply to your role" });

    await db
      .insert(notificationPreferences)
      .values({ userId: user.id, event: body.event, email: body.email, inApp: body.inApp })
      .onConflictDoUpdate({ target: [notificationPreferences.userId, notificationPreferences.event], set: { email: body.email, inApp: body.inApp } });
    return reply.status(204).send();
  });
}
