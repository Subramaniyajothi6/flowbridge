import { z } from "zod";
import { POWERED_BY, renderEmail } from "./email-layout.ts";
import { GOOGLE_IDENTITY_HOST, GOOGLE_IDENTITY_SCOPES, testGoogleConnection } from "./google-shared.ts";
import { defineAction, type Connector } from "./types.ts";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// A line break in the subject could be used to add extra email headers.
const singleLine = z.coerce.string().refine((text) => !/[\r\n]/.test(text), "Must be a single line");

const base64 = (text: string) => Buffer.from(text, "utf8").toString("base64");

// With html, the email carries both versions. Email programs show the designed one,
// and fall back to the plain text when they cannot show HTML.
export function buildRawEmail(to: string, subject: string, body: string, html?: string): string {
  const headers = [`To: ${to}`, `Subject: =?UTF-8?B?${base64(subject)}?=`, "MIME-Version: 1.0"];
  const part = (type: string, content: string) => [`Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", base64(content)];

  let message: string[];
  if (html === undefined) {
    message = [...headers, ...part("text/plain", body)];
  } else {
    const boundary = `flowbridge-${Date.now().toString(36)}`;
    message = [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      ...part("text/plain", body),
      `--${boundary}`,
      ...part("text/html", html),
      `--${boundary}--`,
    ];
  }
  return Buffer.from(message.join("\r\n"), "utf8").toString("base64url");
}

const optionalText = z.coerce.string().optional();

// The fields that turn an email into a designed one. Without a heading, the email stays plain text.
const sendEmailInput = z.object({
  to: z.email(),
  subject: singleLine,
  body: z.coerce.string(),
  heading: optionalText,
  style: z.enum(["clean_card", "branded_header"]).optional(),
  brand: optionalText,
  tagline: optionalText,
  facts: optionalText,
  highlight: optionalText,
  buttonText: optionalText,
  buttonUrl: optionalText,
  footer: optionalText,
});

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
      description: "Send an email. Add a heading to send it as a designed email.",
      input: sendEmailInput,
      async run({ request }, input) {
        const html = input.heading?.trim()
          ? renderEmail({ heading: input.heading, body: input.body, style: input.style, brand: input.brand, tagline: input.tagline, facts: input.facts, highlight: input.highlight, buttonText: input.buttonText, buttonUrl: input.buttonUrl, footer: input.footer })
          : undefined;
        const response = await request(`${API}/messages/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          // In the plain-text copy, "## Heading" lines read better without the marks, and it is signed like the designed one.
          body: JSON.stringify({ raw: buildRawEmail(input.to, input.subject, html ? `${input.body.replace(/^##\s+/gm, "")}\n\n--\n${POWERED_BY}` : input.body, html) }),
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
