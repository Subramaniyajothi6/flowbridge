import { z } from "zod";
import { GOOGLE_IDENTITY_HOST, GOOGLE_IDENTITY_SCOPES, testGoogleConnection } from "./google-shared.ts";
import { defineAction, type Connector } from "./types.ts";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// A line break in the subject could be used to add extra email headers.
const singleLine = z.coerce.string().refine((text) => !/[\r\n]/.test(text), "Must be a single line");

export function buildRawEmail(to: string, subject: string, body: string): string {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  const message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body, "utf8").toString("base64"),
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

export const gmail: Connector = {
  id: "gmail",
  name: "Gmail",
  auth: {
    type: "oauth",
    provider: "google",
    scopes: [
      ...GOOGLE_IDENTITY_SCOPES,
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
  },
  allowedHosts: ["gmail.googleapis.com", GOOGLE_IDENTITY_HOST],
  test: testGoogleConnection,

  actions: {
    send_email: defineAction({
      description: "Send an email",
      input: z.object({ to: z.email(), subject: singleLine, body: z.coerce.string() }),
      async run({ request }, input) {
        const response = await request(`${API}/messages/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ raw: buildRawEmail(input.to, input.subject, input.body) }),
        });
        return { id: response.id, threadId: response.threadId };
      },
    }),

    list_messages: defineAction({
      description: "Find messages using a Gmail search, such as is:unread",
      input: z.object({
        query: z.coerce.string().default(""),
        limit: z.coerce.number().int().min(1).max(100).default(10),
      }),
      async run({ request }, { query, limit }) {
        const search = new URLSearchParams({ q: query, maxResults: String(limit) });
        const response = await request(`${API}/messages?${search}`);
        return { messages: response.messages ?? [] };
      },
    }),

    get_message: defineAction({
      description: "Read one message",
      input: z.object({ messageId: z.string().regex(/^[a-zA-Z0-9]+$/) }),
      async run({ request }, { messageId }) {
        const message = await request(`${API}/messages/${messageId}?format=full`);
        const headers = (name: string) =>
          message.payload?.headers?.find((item: { name: string }) => item.name.toLowerCase() === name)?.value ?? null;
        return {
          id: message.id,
          threadId: message.threadId,
          snippet: message.snippet,
          from: headers("from"),
          subject: headers("subject"),
          date: headers("date"),
        };
      },
    }),
  },
};
