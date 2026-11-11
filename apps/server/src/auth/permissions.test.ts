import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { permissionsFor } from "./permissions.ts";

describe("the three roles", () => {
  it("lets an Administrator do everything", () => {
    assert.deepEqual(permissionsFor("administrator").sort(), [
      "approvals.decide", "apps.manage", "builder.view", "integrations.manage", "integrations.view",
      "members.manage", "runs.retry", "runs.view", "runs.viewStepData", "settings.manage", "system.view",
      "workflows.edit", "workflows.publish", "workflows.run", "workflows.view",
    ]);
  });

  it("lets a Workflow Builder do everything except run the workspace", () => {
    const allowed = permissionsFor("workflow_builder");
    for (const permission of ["workflows.edit", "workflows.publish", "builder.view", "runs.viewStepData", "runs.retry", "approvals.decide", "integrations.manage", "system.view"] as const) {
      assert.ok(allowed.includes(permission), permission);
    }
    for (const permission of ["members.manage", "settings.manage", "apps.manage"] as const) {
      assert.ok(!allowed.includes(permission), permission);
    }
  });

  it("lets a Business User run, follow, retry and approve, but not build or connect", () => {
    assert.deepEqual(permissionsFor("business_user").sort(), [
      "approvals.decide", "runs.retry", "runs.view", "workflows.run", "workflows.view",
    ]);
  });
});
