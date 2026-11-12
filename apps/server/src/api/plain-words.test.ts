import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkflowDefinition } from "../engine/definition.ts";
import { inputFieldsOf, plainFailure, runSentence } from "./plain-words.ts";

describe("words for Business Users", () => {
  it("finds the details a workflow needs to start, once each, in order", () => {
    const definition = {
      steps: [
        { id: "save", name: "Save", type: "connector", config: { connector: "google_sheets", action: "append_row", connectionId: "", params: { values: ["{{trigger.body.name}}", "{{ trigger.body.email }}", "{{trigger.body.company}}"] } } },
        { id: "mail", name: "Mail", type: "connector", config: { connector: "gmail", action: "send_email", connectionId: "", params: { to: "{{trigger.body.email}}", subject: "Hi {{trigger.body.name}}", body: "{{trigger.ticket}}" } } },
        { id: "next", name: "Next", type: "connector", config: { connector: "slack", action: "send_message", connectionId: "", params: { text: "{{steps.save.output.id}}" } } },
      ],
      edges: [],
    } as unknown as WorkflowDefinition;

    assert.deepEqual(inputFieldsOf(definition), [
      { path: "body.name", name: "name" },
      { path: "body.email", name: "email" },
      { path: "body.company", name: "company" },
      { path: "ticket", name: "ticket" },
    ]);
    assert.deepEqual(inputFieldsOf({ steps: [], edges: [] }), []);
  });

  it("tells what happened to each run in one sentence", () => {
    const base = { workflowName: "Welcome new customers", waitKind: null, failedStepName: null, reason: null };
    assert.deepEqual(runSentence({ ...base, status: "succeeded" }), { text: "Welcome new customers finished.", tone: "ok" });
    assert.deepEqual(runSentence({ ...base, status: "running" }), { text: "Welcome new customers is running now.", tone: "run" });
    assert.equal(runSentence({ ...base, status: "waiting", waitKind: "approval" }).text, "Welcome new customers is waiting for a decision.");
    assert.equal(
      runSentence({ ...base, status: "failed", failedStepName: "Send welcome email", reason: "Gmail has reached its limit for now." }).text,
      "Welcome new customers stopped at Send welcome email, because Gmail has reached its limit for now.",
    );
    assert.equal(
      runSentence({ ...base, status: "failed", failedStepName: "Save", reason: "The Google Sheets account needs connecting again." }).text,
      "Welcome new customers stopped at Save, because the Google Sheets account needs connecting again.",
    );
  });

  it("explains failures plainly, and says when retrying is worth it", () => {
    assert.deepEqual(plainFailure("Slack", "Slack said: channel_not_found"), { text: "Slack could not find what it needed, such as a channel, sheet or record.", retryHelps: false });
    assert.deepEqual(plainFailure("Gmail", "Gmail replied with status 429: limit"), { text: "Gmail has reached its limit for now.", retryHelps: true });
    assert.deepEqual(plainFailure("Google Sheets", "The Google Sheets connection has expired. Please connect it again."), { text: "The Google Sheets account needs connecting again.", retryHelps: false });
    assert.equal(plainFailure(null, "odd").retryHelps, true);
  });
});
