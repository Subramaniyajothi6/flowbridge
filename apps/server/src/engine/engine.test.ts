import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workflowDefinitionSchema } from "./definition.ts";
import { findNextAction, type StepState } from "./next-action.ts";
import { MissingReferenceError, resolveReferences } from "./references.ts";
import { isPrivateAddress } from "./steps/http-step.ts";
import { runIfStep } from "./steps/if-step.ts";

const http = (id: string) => ({
  id,
  name: id,
  type: "http_request" as const,
  config: { method: "GET" as const, url: "https://example.com", headers: {} },
});
const ifStep = (id: string) => ({
  id,
  name: id,
  type: "if" as const,
  config: { left: 1, operator: "equals" as const, right: 1 },
});
const done = (output: unknown = {}): StepState => ({ status: "succeeded", output });

describe("references", () => {
  const context = { trigger: { name: "Asha", tags: ["a", "b"] }, steps: { first: { output: { id: 7 } } } };

  it("keeps the original type when the whole string is a reference", () => {
    assert.equal(resolveReferences("{{steps.first.output.id}}", context), 7);
  });

  it("builds text when a reference is inside a sentence", () => {
    assert.equal(resolveReferences("Hi {{ trigger.name }}, id {{steps.first.output.id}}", context), "Hi Asha, id 7");
  });

  it("resolves inside nested objects and array positions", () => {
    assert.deepEqual(resolveReferences({ a: ["{{trigger.tags.1}}"] }, context), { a: ["b"] });
  });

  it("fails clearly when a value is missing", () => {
    assert.throws(() => resolveReferences("{{trigger.nope}}", context), MissingReferenceError);
  });

  it("cannot reach built-in object properties", () => {
    assert.throws(() => resolveReferences("{{trigger.__proto__}}", context), MissingReferenceError);
    assert.throws(() => resolveReferences("{{trigger.constructor}}", context), MissingReferenceError);
  });

  it("can return undefined instead of failing", () => {
    assert.equal(resolveReferences("{{trigger.nope}}", context, "undefined"), undefined);
  });
});

describe("definition rules", () => {
  it("accepts a valid branching workflow", () => {
    const result = workflowDefinitionSchema.safeParse({
      steps: [ifStep("check"), http("yes"), http("no")],
      edges: [
        { from: "check", to: "yes", when: "true" },
        { from: "check", to: "no", when: "false" },
      ],
    });
    assert.equal(result.success, true);
  });

  const invalid = {
    "duplicate ids": { steps: [http("a"), http("a")], edges: [] },
    "unknown step": { steps: [http("a")], edges: [{ from: "a", to: "b" }] },
    loop: {
      steps: [http("a"), http("b")],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    },
    "true edge from a normal step": { steps: [http("a"), http("b")], edges: [{ from: "a", to: "b", when: "true" }] },
    "success edge from an If step": { steps: [ifStep("a"), http("b")], edges: [{ from: "a", to: "b" }] },
  };

  it("accepts an empty workflow, so one can be built up on the canvas", () => {
    assert.equal(workflowDefinitionSchema.safeParse({ steps: [], edges: [] }).success, true);
  });

  it("keeps a step's canvas position", () => {
    const parsed = workflowDefinitionSchema.parse({ steps: [{ ...http("a"), position: { x: 10, y: 20 } }] });
    assert.deepEqual(parsed.steps[0].position, { x: 10, y: 20 });
  });

  for (const [name, definition] of Object.entries(invalid)) {
    it(`rejects ${name}`, () => {
      assert.equal(workflowDefinitionSchema.safeParse(definition).success, false);
    });
  }
});

describe("choosing the next action", () => {
  const line = { steps: [http("a"), http("b")], edges: [{ from: "a", to: "b", when: "success" as const }] };
  const branch = {
    steps: [ifStep("check"), http("yes"), http("no"), http("end")],
    edges: [
      { from: "check", to: "yes", when: "true" as const },
      { from: "check", to: "no", when: "false" as const },
      { from: "yes", to: "end", when: "success" as const },
      { from: "no", to: "end", when: "success" as const },
    ],
  };

  it("starts with a step that has nothing before it", () => {
    assert.deepEqual(findNextAction(line, new Map()), { type: "run", stepId: "a" });
  });

  it("does not repeat finished steps", () => {
    assert.deepEqual(findNextAction(line, new Map([["a", done()]])), { type: "run", stepId: "b" });
  });

  it("runs a step again if a worker died during it", () => {
    const states = new Map<string, StepState>([["a", { status: "running", output: null }]]);
    assert.deepEqual(findNextAction(line, states), { type: "run", stepId: "a" });
  });

  it("finishes as succeeded when every step is done", () => {
    assert.deepEqual(findNextAction(line, new Map([["a", done()], ["b", done()]])), {
      type: "finish",
      status: "succeeded",
    });
  });

  it("finishes as failed when a step failed", () => {
    const states = new Map<string, StepState>([["a", { status: "failed", output: null }]]);
    assert.deepEqual(findNextAction(line, states), { type: "finish", status: "failed" });
  });

  it("follows the branch that matches the If result and skips the other", () => {
    const afterCheck = new Map([["check", done({ result: true })]]);
    assert.deepEqual(findNextAction(branch, afterCheck), { type: "run", stepId: "yes" });

    afterCheck.set("yes", done());
    assert.deepEqual(findNextAction(branch, afterCheck), { type: "skip", stepId: "no" });
  });

  it("runs a step after branches rejoin", () => {
    const states = new Map<string, StepState>([
      ["check", done({ result: true })],
      ["yes", done()],
      ["no", { status: "skipped", output: null }],
    ]);
    assert.deepEqual(findNextAction(branch, states), { type: "run", stepId: "end" });
  });

  it("skips a step when everything before it was skipped", () => {
    const skippedChain = {
      steps: [ifStep("check"), http("no"), http("after")],
      edges: [
        { from: "check", to: "no", when: "false" as const },
        { from: "no", to: "after", when: "success" as const },
      ],
    };
    const states = new Map<string, StepState>([
      ["check", done({ result: true })],
      ["no", { status: "skipped", output: null }],
    ]);
    assert.deepEqual(findNextAction(skippedChain, states), { type: "skip", stepId: "after" });
  });
});

describe("If step", () => {
  it("treats the number 5 and the text 5 as equal", () => {
    assert.deepEqual(runIfStep({ left: 5, operator: "equals", right: "5" }), { result: true });
  });

  it("compares numbers", () => {
    assert.deepEqual(runIfStep({ left: "10", operator: "greater_than", right: 9 }), { result: true });
  });

  it("checks text and lists with contains", () => {
    assert.deepEqual(runIfStep({ left: "hello", operator: "contains", right: "ell" }), { result: true });
    assert.deepEqual(runIfStep({ left: ["a"], operator: "contains", right: "b" }), { result: false });
  });

  it("treats a missing value as not existing", () => {
    assert.deepEqual(runIfStep({ left: undefined, operator: "exists" }), { result: false });
  });

  it("fails on a number comparison with text", () => {
    assert.throws(() => runIfStep({ left: "abc", operator: "less_than", right: 1 }));
  });
});

describe("private address check", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "169.254.169.254", "::1", "::ffff:127.0.0.1", "fd00::1"]) {
    it(`blocks ${address}`, () => assert.equal(isPrivateAddress(address), true));
  }
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
    it(`allows ${address}`, () => assert.equal(isPrivateAddress(address), false));
  }
});
