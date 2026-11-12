import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminTasks, type ConnectionFacts } from "./admin-tasks.ts";

const now = new Date("2026-11-12T10:00:00Z");
const hoursFromNow = (hours: number) => new Date(now.getTime() + hours * 3600 * 1000);
const quiet = { connections: [], members: [], limitHits: [], used: 0, limit: 25000, now };

const sheets = (changes: Partial<ConnectionFacts>): ConnectionFacts => ({ appName: "Google Sheets", account: "a@example.com", status: "active", expiresAt: null, workflowCount: 3, ...changes });

describe("what needs an Administrator", () => {
  it("is empty when everything is fine", () => {
    assert.deepEqual(adminTasks(quiet), []);
  });

  it("warns about a connection that expires within two days, but not later", () => {
    const soon = adminTasks({ ...quiet, connections: [sheets({ expiresAt: hoursFromNow(30) })] });
    assert.equal(soon[0].title, "The Google Sheets connection expires in 2 days");
    assert.equal(soon[0].detail, "a@example.com. 3 workflows use this connection.");

    assert.equal(adminTasks({ ...quiet, connections: [sheets({ expiresAt: hoursFromNow(5) })] })[0].title, "The Google Sheets connection expires within a day");
    assert.deepEqual(adminTasks({ ...quiet, connections: [sheets({ expiresAt: hoursFromNow(72) })] }), []);
  });

  it("asks for a broken connection to be connected again", () => {
    const [task] = adminTasks({ ...quiet, connections: [sheets({ status: "needs_reconnect", workflowCount: 1, account: null })] });
    assert.equal(task.title, "The Google Sheets connection needs connecting again");
    assert.equal(task.detail, "1 workflow uses this connection.");
    assert.equal(task.href, "/integrations");
  });

  it("reports an app that reached its limit, and a nearly used-up run allowance", () => {
    const tasks = adminTasks({ ...quiet, limitHits: [{ appName: "Gmail", failures: 4 }], used: 20500, limit: 25000 });
    assert.deepEqual(tasks.map((task) => task.title), ["Gmail reached a sending or usage limit", "82% of this month's live runs are used"]);
    assert.equal(adminTasks({ ...quiet, used: 19000 }).length, 0);
  });

  it("lists members who have never signed in", () => {
    const [task] = adminTasks({
      ...quiet,
      members: [
        { name: "Lena Costa", role: "business_user", createdAt: new Date("2026-11-11T09:00:00Z"), lastSignInAt: null },
        { name: "Jonah Thomas", role: "administrator", createdAt: new Date("2026-11-01T09:00:00Z"), lastSignInAt: now },
      ],
    });
    assert.equal(task.title, "Lena Costa has not signed in yet");
    assert.equal(task.detail, "Added yesterday as a Business User.");
    assert.equal(task.action, "Open team");
  });
});
