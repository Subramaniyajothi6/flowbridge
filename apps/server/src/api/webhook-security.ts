import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-flowbridge-signature";

// Different services name their unique delivery ID differently.
const DELIVERY_ID_HEADERS = ["idempotency-key", "webhook-id", "x-github-delivery", "x-shopify-webhook-id"];
const MAX_DELIVERY_ID_LENGTH = 255;

const SENSITIVE_HEADER = /authorization|cookie|token|secret|signature|api-key/i;

type Headers = Record<string, string | string[] | undefined>;

export function signPayload(payload: Buffer, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function isSignatureValid(payload: Buffer, secret: string, signature: unknown): boolean {
  if (typeof signature !== "string") return false;
  const expected = Buffer.from(signPayload(payload, secret));
  const received = Buffer.from(signature);
  // timingSafeEqual takes the same time wherever the first difference is,
  // so an attacker cannot work out the signature one character at a time.
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function findDeliveryId(headers: Headers): string | undefined {
  for (const name of DELIVERY_ID_HEADERS) {
    const value = headers[name];
    if (typeof value !== "string" || value === "") continue;
    if (value.length > MAX_DELIVERY_ID_LENGTH) throw new Error(`The ${name} header is too long`);
    return value;
  }
  return undefined;
}

// Run details are shown to users and kept in the database, so secrets are left out.
export function removeSensitiveHeaders(headers: Headers): Headers {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !SENSITIVE_HEADER.test(name)));
}

export function parseWebhookBody(rawBody: Buffer | undefined, contentType: string | undefined): unknown {
  if (!rawBody || rawBody.length === 0) return null;
  const text = rawBody.toString("utf8");

  if (contentType?.includes("json")) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("The body is not valid JSON");
    }
  }
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  return text;
}
