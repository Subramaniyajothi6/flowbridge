import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { buildRawEmail, gmail } from "../connectors/gmail.ts";
import { googleSheets } from "../connectors/google-sheets.ts";
import { connectors } from "../connectors/registry.ts";
import { slack } from "../connectors/slack.ts";
import { stripe } from "../connectors/stripe.ts";
import type { Connector, RequestOptions } from "../connectors/types.ts";
import { workflowDefinitionSchema } from "../engine/definition.ts";
import { pollConfigSchema } from "../triggers/definition.ts";
import { censorSecrets } from "./censor.ts";
import { decryptText, encryptText, parseKeyRing } from "./crypto.ts";

const newKey = () => randomBytes(32).toString("base64");

describe("encryption", () => {
  const ring = parseKeyRing(`k1:${newKey()}`);

  it("gets back the original text", () => {
    assert.equal(decryptText(encryptText("xoxb-secret", ring), ring), "xoxb-secret");
  });

  it("does not contain the original text", () => {
    assert.equal(encryptText("xoxb-secret", ring).includes("xoxb"), false);
  });

  it("gives a different result each time", () => {
    assert.notEqual(encryptText("same", ring), encryptText("same", ring));
  });

  it("detects a changed value", () => {
    const parts = encryptText("secret", ring).split(".");
    const flipped = parts[3][0] === "A" ? "B" : "A";
    parts[3] = flipped + parts[3].slice(1);
    assert.throws(() => decryptText(parts.join("."), ring));
  });

  it("cannot be opened with a different key", () => {
    const other = parseKeyRing(`k1:${newKey()}`);
    assert.throws(() => decryptText(encryptText("secret", ring), other));
  });

  it("still opens old values after a new key is added", () => {
    const oldKey = newKey();
    const before = parseKeyRing(`old:${oldKey}`);
    const after = parseKeyRing(`new:${newKey()},old:${oldKey}`);
    const stored = encryptText("secret", before);

    assert.equal(decryptText(stored, after), "secret");
    assert.ok(encryptText("secret", after).startsWith("new."));
  });

  it("rejects a key of the wrong size", () => {
    assert.throws(() => parseKeyRing("k1:c2hvcnQ="));
    assert.throws(() => parseKeyRing(""));
  });
});

describe("hiding secrets", () => {
  it("hides secret fields at any depth", () => {
    const result = censorSecrets({
      headers: { Authorization: "Bearer x", "x-api-key": "y" },
      list: [{ client_secret: "z", access_token: "t" }],
      name: "kept",
      count: 2,
    });
    assert.deepEqual(result, {
      headers: { Authorization: "[hidden]", "x-api-key": "[hidden]" },
      list: [{ client_secret: "[hidden]", access_token: "[hidden]" }],
      name: "kept",
      count: 2,
    });
  });

  it("keeps page tokens, which are not secret", () => {
    assert.deepEqual(censorSecrets({ nextPageToken: "abc" }), { nextPageToken: "abc" });
  });

  it("leaves plain values alone", () => {
    assert.equal(censorSecrets("text"), "text");
    assert.equal(censorSecrets(null), null);
  });
});

// Records the request instead of sending it, and replies with a canned response.
function fakeContext(reply: unknown) {
  const calls: { url: string; options: RequestOptions }[] = [];
  const request = async (url: string, options: RequestOptions = {}) => {
    calls.push({ url, options });
    return reply;
  };
  return { calls, context: { request, idempotencyKey: "run1:step1" } };
}

function runAction(connector: Connector, name: string, params: unknown, reply: unknown) {
  const fake = fakeContext(reply);
  const action = connector.actions[name];
  return action.run(fake.context, action.input.parse(params)).then((output) => ({ output, calls: fake.calls }));
}

describe("every connector", () => {
  for (const connector of Object.values(connectors)) {
    it(`${connector.id} declares its hosts and actions`, () => {
      assert.ok(connector.allowedHosts.length > 0);
      assert.ok(Object.keys(connector.actions).length > 0);
    });
  }
});

describe("Slack", () => {
  it("posts a message", async () => {
    const { output, calls } = await runAction(slack, "send_message", { channel: "#general", text: 5 }, { ok: true, channel: "C1", ts: "1.2" });
    assert.equal(calls[0].url, "https://slack.com/api/chat.postMessage");
    assert.deepEqual(JSON.parse(calls[0].options.body as string), { channel: "#general", text: "5" });
    assert.deepEqual(output, { channel: "C1", timestamp: "1.2" });
  });

  it("treats ok false as a failure, even with status 200", async () => {
    await assert.rejects(runAction(slack, "send_message", { channel: "x", text: "y" }, { ok: false, error: "channel_not_found" }), /channel_not_found/);
  });

  it("only accepts bot tokens", () => {
    assert.ok(slack.auth.type === "token" && slack.auth.pattern.test("xoxb-1") && !slack.auth.pattern.test("xoxp-1"));
  });
});

describe("Stripe", () => {
  it("sends form data with the idempotency key", async () => {
    const { calls } = await runAction(stripe, "create_customer", { email: "a@b.co", name: "Asha" }, { id: "cus_1" });
    assert.equal(calls[0].url, "https://api.stripe.com/v1/customers");
    assert.equal(calls[0].options.headers?.["idempotency-key"], "run1:step1");
    assert.equal(calls[0].options.body, "email=a%40b.co&name=Asha");
  });

  it("creates a payment from text numbers and leaves out empty fields", async () => {
    const { calls } = await runAction(stripe, "create_payment_intent", { amount: "500", currency: "inr" }, { id: "pi_1" });
    assert.equal(new URLSearchParams(calls[0].options.body as string).get("amount"), "500");
    assert.equal(new URLSearchParams(calls[0].options.body as string).has("customer"), false);
  });

  it("refuses live keys", () => {
    assert.ok(stripe.auth.type === "token");
    assert.equal(stripe.auth.pattern.test("sk_live_abc"), false);
    assert.equal(stripe.auth.pattern.test("sk_test_abc"), true);
  });
});

describe("Google Sheets", () => {
  it("appends a row", async () => {
    const reply = { updates: { updatedRange: "Sheet1!A2:B2", updatedRows: 1 } };
    const { output, calls } = await runAction(googleSheets, "append_row", { spreadsheetId: "abc-1", values: ["a", 2, { b: 1 }] }, reply);
    assert.equal(calls[0].url, "https://sheets.googleapis.com/v4/spreadsheets/abc-1/values/Sheet1:append?valueInputOption=USER_ENTERED");
    assert.deepEqual(JSON.parse(calls[0].options.body as string), { values: [["a", 2, '{"b":1}']] });
    assert.deepEqual(output, { updatedRange: "Sheet1!A2:B2", updatedRows: 1 });
  });

  it("encodes the range, and returns an empty list for an empty sheet", async () => {
    const { output, calls } = await runAction(googleSheets, "read_rows", { spreadsheetId: "abc", range: "My Sheet!A1:B2" }, { range: "x" });
    assert.ok(calls[0].url.endsWith("/values/My%20Sheet!A1%3AB2"));
    assert.deepEqual(output, { range: "x", rows: [] });
  });

  it("refuses a spreadsheet ID that could change the address", () => {
    assert.equal(googleSheets.actions.read_rows.input.safeParse({ spreadsheetId: "../other" }).success, false);
  });
});

describe("Gmail", () => {
  const decode = (raw: string) => Buffer.from(raw, "base64url").toString("utf8");

  it("builds a readable email, including non-English text", () => {
    const parts = decode(buildRawEmail("a@b.co", "வணக்கம்", "Hello ₹500")).split("\r\n");
    assert.equal(parts[0], "To: a@b.co");
    assert.equal(Buffer.from(parts[1].slice(19, -2), "base64").toString("utf8"), "வணக்கம்");
    assert.equal(Buffer.from(parts.at(-1) as string, "base64").toString("utf8"), "Hello ₹500");
  });

  it("sends the email", async () => {
    const { output, calls } = await runAction(gmail, "send_email", { to: "a@b.co", subject: "Hi", body: "Text" }, { id: "m1", threadId: "t1" });
    assert.equal(calls[0].url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    assert.deepEqual(output, { id: "m1", threadId: "t1" });
  });

  it("refuses a subject that could add extra headers", () => {
    const parsed = gmail.actions.send_email.input.safeParse({ to: "a@b.co", subject: "Hi\r\nBcc: x@y.co", body: "" });
    assert.equal(parsed.success, false);
  });

  it("refuses a bad address", () => {
    assert.equal(gmail.actions.send_email.input.safeParse({ to: "nope", subject: "s", body: "b" }).success, false);
  });

  it("picks out the main message details", async () => {
    const reply = { id: "m1", threadId: "t1", snippet: "Hey", payload: { headers: [{ name: "From", value: "x@y.co" }, { name: "Subject", value: "S" }] } };
    const { output } = await runAction(gmail, "get_message", { messageId: "m1" }, reply);
    assert.deepEqual(output, { id: "m1", threadId: "t1", snippet: "Hey", from: "x@y.co", subject: "S", date: null });
  });
});

describe("connector steps in workflows", () => {
  const connectionId = "11111111-1111-4111-8111-111111111111";
  const step = (connector: string, action: string) => ({
    id: "a",
    name: "a",
    type: "connector",
    config: { connector, action, connectionId, params: {} },
  });

  it("accepts a known action", () => {
    assert.equal(workflowDefinitionSchema.safeParse({ steps: [step("slack", "send_message")] }).success, true);
  });

  it("rejects unknown connectors and actions", () => {
    assert.equal(workflowDefinitionSchema.safeParse({ steps: [step("nope", "send_message")] }).success, false);
    assert.equal(workflowDefinitionSchema.safeParse({ steps: [step("slack", "nope")] }).success, false);
    assert.equal(workflowDefinitionSchema.safeParse({ steps: [step("__proto__", "toString")] }).success, false);
    assert.equal(workflowDefinitionSchema.safeParse({ steps: [step("slack", "toString")] }).success, false);
  });
});

describe("poll settings and secrets", () => {
  it("refuses credentials in headers", () => {
    const parsed = pollConfigSchema.safeParse({ url: "https://a.co", itemIdField: "id", headers: { Authorization: "x" } });
    assert.equal(parsed.success, false);
  });

  it("accepts ordinary headers", () => {
    const parsed = pollConfigSchema.safeParse({ url: "https://a.co", itemIdField: "id", headers: { accept: "application/json" } });
    assert.equal(parsed.success, true);
  });
});
