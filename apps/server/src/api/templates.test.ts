import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkflowDefinition } from "../engine/definition.ts";
import { withoutConnections } from "./templates.ts";

describe("saving a workflow as a template", () => {
  const workflow = {
    steps: [
      { id: "post", name: "Post", type: "connector", config: { connector: "slack", action: "send_message", connectionId: "11111111-1111-4111-8111-111111111111", params: { channel: "#sales", text: "Hi" } } },
      { id: "each", name: "Each", type: "loop", config: { items: "{{trigger.body.items}}", action: { type: "connector", config: { connector: "slack", action: "send_message", connectionId: "22222222-2222-4222-8222-222222222222", params: {} } } } },
      { id: "wait", name: "Wait", type: "delay", config: { amount: 5, unit: "minutes" } },
    ],
    edges: [{ from: "post", to: "each", when: "success" }],
  } as unknown as WorkflowDefinition;

  it("leaves out every account, including inside a loop", () => {
    const template = withoutConnections(workflow) as any;
    assert.equal(template.steps[0].config.connectionId, "");
    assert.equal(template.steps[1].config.action.config.connectionId, "");
  });

  it("keeps everything else, and does not change the workflow itself", () => {
    const template = withoutConnections(workflow) as any;
    assert.deepEqual(template.steps[0].config.params, { channel: "#sales", text: "Hi" });
    assert.deepEqual(template.edges, workflow.edges);
    assert.equal((workflow as any).steps[0].config.connectionId, "11111111-1111-4111-8111-111111111111");
  });
});
