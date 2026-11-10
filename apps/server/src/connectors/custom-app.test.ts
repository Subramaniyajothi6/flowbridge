import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customAppSchema, toConnector, type CustomAppDefinition } from "./custom-app.ts";
import type { ConnectorAction, RequestOptions } from "./types.ts";

const createIssue = {
  name: "Create issue",
  method: "POST" as const,
  path: "/issue",
  fields: [{ name: "project", required: true }, { name: "summary", required: true }, { name: "note", required: false }],
  bodyTemplate: '{ "fields": { "project": { "key": "{{project}}" }, "summary": "Task: {{summary}}", "note": "{{note}}" } }',
};
const getIssue = { name: "Get issue", method: "GET" as const, path: "/issue/{{key}}", fields: [{ name: "key", required: true }, { name: "expand", required: false }] };

const app = { name: "Tracker", baseUrl: "https://tracker.example.com/api/", authType: "bearer" as const, testPath: "/me", actions: [createIssue, getIssue] };

function connectorFor(definition: CustomAppDefinition) {
  return toConnector("app_tracker", definition, { allowPrivateUrls: true });
}

async function runAction(action: ConnectorAction, input: unknown, reply: unknown = { id: 1 }) {
  const calls: { url: string; options?: RequestOptions }[] = [];
  const result = await action.run({ idempotencyKey: "run:step", request: async (url, options) => { calls.push({ url, options }); return reply; } }, action.input.parse(input));
  return { call: calls[0], result };
}

const invalidApp = (changes: object) => customAppSchema.safeParse({ ...app, ...changes }).success;

describe("adding a custom app", () => {
  it("accepts a valid app", () => assert.equal(invalidApp({}), true));
  it("requires https, so keys are not sent unencrypted", () => assert.equal(invalidApp({ baseUrl: "http://tracker.example.com" }), false));
  it("refuses sign-in details inside the address", () => assert.equal(invalidApp({ baseUrl: "https://a:b@tracker.example.com" }), false));
  it("needs a header name for header sign-in", () => assert.equal(invalidApp({ authType: "header" }), false));
  it("needs at least one action", () => assert.equal(invalidApp({ actions: [] }), false));
  it("refuses two actions with the same name", () => assert.equal(invalidApp({ actions: [getIssue, getIssue] }), false));
  it("refuses a body that is not JSON", () => assert.equal(invalidApp({ actions: [{ ...createIssue, bodyTemplate: "{ nope" }] }), false));
  it("refuses a body on a GET request", () => assert.equal(invalidApp({ actions: [{ ...getIssue, bodyTemplate: "{}" }] }), false));
  it("refuses a body that uses an unknown field", () => assert.equal(invalidApp({ actions: [{ ...createIssue, bodyTemplate: '{ "a": "{{typo}}" }' }] }), false));
  it("refuses a path field that is optional", () => assert.equal(invalidApp({ actions: [{ ...getIssue, fields: [{ name: "key", required: false }] }] }), false));
});

describe("running a custom app's action", () => {
  const parsed = customAppSchema.parse(app);
  const connector = connectorFor(parsed);

  it("only allows the app's own host", () => assert.deepEqual(connector.allowedHosts, ["tracker.example.com"]));

  it("fills in the body template and keeps the base path", async () => {
    const { call } = await runAction(connector.actions.create_issue, { project: "OPS", summary: "Call Asha" });
    assert.equal(call.url, "https://tracker.example.com/api/issue");
    assert.equal(call.options?.method, "POST");
    assert.deepEqual(JSON.parse(call.options?.body as string), { fields: { project: { key: "OPS" }, summary: "Task: Call Asha" } });
  });

  it("sends the same repeat key on every attempt", async () => {
    const { call } = await runAction(connector.actions.create_issue, { project: "OPS", summary: "x" });
    assert.equal(call.options?.headers?.["idempotency-key"], "run:step");
  });

  it("puts a field in the path and sends the others as a query", async () => {
    const { call } = await runAction(connector.actions.get_issue, { key: "OPS-1", expand: "names" });
    assert.equal(call.url, "https://tracker.example.com/api/issue/OPS-1?expand=names");
  });

  it("cannot be steered to another address by a value", async () => {
    const { call } = await runAction(connector.actions.get_issue, { key: "a/b?x=1" });
    assert.equal(call.url, "https://tracker.example.com/api/issue/a%2Fb%3Fx%3D1");
  });

  it("refuses to run without a required field", () => {
    assert.equal(connector.actions.create_issue.input.safeParse({ project: "OPS" }).success, false);
  });

  it("wraps a reply that is not an object", async () => {
    const { result } = await runAction(connector.actions.get_issue, { key: "A" }, "plain text");
    assert.deepEqual(result, { response: "plain text" });
  });

  it("sends the same fields as JSON when there is no template", async () => {
    const plain = connectorFor(customAppSchema.parse({ ...app, actions: [{ name: "Add", method: "POST", path: "/x", fields: [{ name: "a", required: true }] }] }));
    const { call } = await runAction(plain.actions.add, { a: "1" });
    assert.equal(call.options?.body, '{"a":"1"}');
  });
});

describe("how a custom app signs in", () => {
  it("uses the default bearer token", () => {
    assert.equal(connectorFor(customAppSchema.parse(app)).credentialHeaders, undefined);
  });

  it("sends the key in a named header", () => {
    const connector = connectorFor(customAppSchema.parse({ ...app, authType: "header", headerName: "X-Api-Key" }));
    assert.deepEqual(connector.credentialHeaders?.("secret"), { "X-Api-Key": "secret" });
  });

  it("sends an email and token as basic sign-in", () => {
    const connector = connectorFor(customAppSchema.parse({ ...app, authType: "basic" }));
    assert.deepEqual(connector.credentialHeaders?.("a@b.c:tok"), { authorization: `Basic ${Buffer.from("a@b.c:tok").toString("base64")}` });
  });
});
