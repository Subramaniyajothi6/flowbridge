import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findDeliveryId,
  isSignatureValid,
  parseWebhookBody,
  removeSensitiveHeaders,
  signPayload,
} from "../api/webhook-security.ts";
import { createTriggerSchema, nextCronTime, scheduleConfigSchema } from "./definition.ts";
import { extractItems, MAX_NEW_ITEMS_PER_POLL, planPoll } from "./poll.ts";

const items = (...ids: number[]) => ids.map((id) => ({ id }));

describe("poll planning", () => {
  it("only remembers existing items on the first check", () => {
    const plan = planPoll(items(1, 2), "id", null);
    assert.deepEqual(plan.newItems, []);
    assert.deepEqual(plan.nextCursor.seenIds, ["1", "2"]);
  });

  it("returns only items it has not seen", () => {
    const plan = planPoll(items(3, 2, 1), "id", { seenIds: ["1", "2"] });
    assert.deepEqual(plan.newItems.map((item) => item.id), ["3"]);
    assert.deepEqual(plan.nextCursor.seenIds, ["3", "2", "1"]);
  });

  it("finds nothing new when the list is unchanged", () => {
    assert.deepEqual(planPoll(items(1), "id", { seenIds: ["1"] }).newItems, []);
  });

  it("handles a repeated item once", () => {
    assert.equal(planPoll(items(5, 5), "id", { seenIds: [] }).newItems.length, 1);
  });

  it("leaves items over the limit for the next check", () => {
    const ids = Array.from({ length: MAX_NEW_ITEMS_PER_POLL + 5 }, (_, index) => index);
    const first = planPoll(items(...ids), "id", { seenIds: [] });
    assert.equal(first.newItems.length, MAX_NEW_ITEMS_PER_POLL);

    const second = planPoll(items(...ids), "id", first.nextCursor);
    assert.equal(second.newItems.length, 5);
    assert.equal(planPoll(items(...ids), "id", second.nextCursor).newItems.length, 0);
  });

  it("keeps the remembered list from growing forever", () => {
    const oldIds = Array.from({ length: 1500 }, (_, index) => `old${index}`);
    assert.equal(planPoll(items(1), "id", { seenIds: oldIds }).nextCursor.seenIds.length, 1000);
  });

  it("never forgets items still in a very long response", () => {
    const ids = Array.from({ length: 1200 }, (_, index) => index);
    const plan = planPoll(items(...ids), "id", null);
    assert.deepEqual(planPoll(items(...ids), "id", plan.nextCursor).newItems, []);
  });

  it("fails clearly when an item has no id", () => {
    assert.throws(() => planPoll([{ name: "x" }], "id", null), /no "id"/);
  });
});

describe("finding the list in a response", () => {
  it("reads a nested list", () => {
    assert.deepEqual(extractItems({ data: { orders: [1] } }, "data.orders"), [1]);
  });

  it("uses the whole response when no path is given", () => {
    assert.deepEqual(extractItems([1, 2], ""), [1, 2]);
  });

  it("fails when the value is not a list", () => {
    assert.throws(() => extractItems({ data: 1 }, "data"), /list/);
    assert.throws(() => extractItems({}, "missing"), /Could not find/);
  });
});

describe("schedules", () => {
  it("finds the next time in the given timezone", () => {
    const next = nextCronTime({ cron: "0 9 * * *", timezone: "Asia/Kolkata" }, new Date("2026-11-09T00:00:00Z"));
    assert.equal(next.toISOString(), "2026-11-09T03:30:00.000Z");
  });

  it("defaults to UTC", () => {
    assert.equal(scheduleConfigSchema.parse({ cron: "0 9 * * *" }).timezone, "UTC");
  });

  for (const [name, config] of Object.entries({
    "nonsense cron": { cron: "not a cron at all" },
    "out of range cron": { cron: "99 * * * *" },
    "a seconds field": { cron: "* * * * * *" },
    "an unknown timezone": { cron: "0 9 * * *", timezone: "Mars/Base" },
  })) {
    it(`rejects ${name}`, () => assert.equal(scheduleConfigSchema.safeParse(config).success, false));
  }
});

describe("poll settings", () => {
  const valid = { type: "poll", config: { url: "https://example.com", itemIdField: "id" } };

  it("accepts valid settings and fills in defaults", () => {
    const parsed = createTriggerSchema.parse(valid);
    assert.equal((parsed.config as { intervalSeconds: number }).intervalSeconds, 300);
  });

  it("rejects checking more often than once a minute", () => {
    const tooFast = { ...valid, config: { ...valid.config, intervalSeconds: 10 } };
    assert.equal(createTriggerSchema.safeParse(tooFast).success, false);
  });
});

describe("webhook security", () => {
  const body = Buffer.from('{"a":1}');

  it("accepts a correct signature", () => {
    assert.equal(isSignatureValid(body, "secret", signPayload(body, "secret")), true);
  });

  it("rejects a wrong secret, a changed body, or no signature", () => {
    assert.equal(isSignatureValid(body, "secret", signPayload(body, "other")), false);
    assert.equal(isSignatureValid(Buffer.from('{"a":2}'), "secret", signPayload(body, "secret")), false);
    assert.equal(isSignatureValid(body, "secret", undefined), false);
    assert.equal(isSignatureValid(body, "secret", "sha256=short"), false);
  });

  it("finds delivery ids from different services", () => {
    assert.equal(findDeliveryId({ "x-github-delivery": "abc" }), "abc");
    assert.equal(findDeliveryId({ "idempotency-key": "first", "webhook-id": "second" }), "first");
    assert.equal(findDeliveryId({}), undefined);
  });

  it("rejects a very long delivery id", () => {
    assert.throws(() => findDeliveryId({ "idempotency-key": "x".repeat(256) }));
  });

  it("removes secrets from saved headers", () => {
    const kept = removeSensitiveHeaders({
      authorization: "Bearer x",
      cookie: "a=b",
      "x-api-key": "k",
      "x-flowbridge-signature": "s",
      "user-agent": "curl",
    });
    assert.deepEqual(kept, { "user-agent": "curl" });
  });

  it("reads JSON, form and plain text bodies", () => {
    assert.deepEqual(parseWebhookBody(Buffer.from('{"a":1}'), "application/json; charset=utf-8"), { a: 1 });
    assert.deepEqual(parseWebhookBody(Buffer.from("a=1&b=2"), "application/x-www-form-urlencoded"), { a: "1", b: "2" });
    assert.equal(parseWebhookBody(Buffer.from("hello"), "text/plain"), "hello");
    assert.equal(parseWebhookBody(undefined, undefined), null);
  });

  it("fails on broken JSON", () => {
    assert.throws(() => parseWebhookBody(Buffer.from("{oops"), "application/json"));
  });
});
