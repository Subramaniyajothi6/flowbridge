import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { failureReason, groupFailures } from "./failure-reasons.ts";

const names: Record<string, string> = { slack: "Slack", google_sheets: "Google Sheets", gmail: "Gmail", http_request: "HTTP request" };
const appName = (app: string) => names[app] ?? app;

describe("why runs failed", () => {
  it("gives real error messages a plain reason", () => {
    assert.equal(failureReason("Slack said: channel_not_found"), "Could not find what it needed");
    assert.equal(failureReason("Google Sheets replied with status 400: Unable to parse range: Customers"), "Could not find what it needed");
    assert.equal(failureReason("Gmail replied with status 429: Daily user sending limit exceeded"), "Sending or usage limit reached");
    assert.equal(failureReason("Slack said: ratelimited"), "Sending or usage limit reached");
    assert.equal(failureReason("The Gmail connection has expired. Please connect it again."), "Access expired or refused");
    assert.equal(failureReason("Slack said: invalid_auth"), "Access expired or refused");
    assert.equal(failureReason("The server replied with status 503"), "The service had a server error");
    assert.equal(failureReason("The operation was aborted due to timeout"), "Took too long to answer");
    assert.equal(failureReason("Stripe replied with status 400: Invalid email address"), "Data was not accepted");
    assert.equal(failureReason("The value given as Items is not a list"), "Data was not accepted");
  });

  it("puts anything unrecognised under Other errors", () => {
    assert.equal(failureReason("Something odd happened"), "Other errors");
    assert.equal(failureReason(null), "Other errors");
  });

  it("adds up failures for the same app and reason, most common first", () => {
    const result = groupFailures([
      { app: "slack", error: "Slack said: channel_not_found", failures: 2 },
      { app: "slack", error: "Slack said: user_not_found", failures: 3 },
      { app: "gmail", error: "Gmail replied with status 429: limit", failures: 4 },
      { app: null, error: "Expected a number but got \"x\"", failures: 1 },
    ], appName);

    assert.deepEqual(result.map((item) => [item.reason, item.failures]), [
      ["Slack: could not find what it needed", 5],
      ["Gmail: sending or usage limit reached", 4],
      ["Data was not accepted", 1],
    ]);
  });

  it("keeps only the most common reasons", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ app: `app${index}`, error: "status 500", failures: index + 1 }));
    const result = groupFailures(many, appName);
    assert.equal(result.length, 5);
    assert.equal(result[0].failures, 8);
  });
});
