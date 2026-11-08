// Proves that a run survives a worker being killed in the middle of a step.
//
// It starts a worker, kills it during the second of three steps, starts another
// worker, and checks that the run finishes without repeating the first step.
//
// Needs DATABASE_URL and an up-to-date database. Run with: npm run crash-test
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// Must be set before config.ts is loaded. The workers inherit these too.
process.env.ALLOW_PRIVATE_URLS = "true";
process.env.LEASE_SECONDS = "5";
process.env.SWEEP_SECONDS = "3";
process.env.RUN_MODE = "worker";

const { eq } = await import("drizzle-orm");
const { db, pool } = await import("../src/db/client.ts");
const { runs, stepRuns, workflows, workflowVersions } = await import("../src/db/schema.ts");
const { createRun } = await import("../src/engine/create-run.ts");
const { workflowDefinitionSchema } = await import("../src/engine/definition.ts");
const { boss, startQueue } = await import("../src/engine/queue.ts");

const serverRoot = path.resolve(import.meta.dirname, "..");
const SLOW_STEP_MS = 6000;

const callsByPath: Record<string, number> = { "/first": 0, "/slow": 0, "/last": 0 };
const keysForSlowStep: (string | undefined)[] = [];

const target = http.createServer(async (request, response) => {
  const url = request.url as string;
  callsByPath[url] += 1;
  if (url === "/slow") {
    keysForSlowStep.push(request.headers["idempotency-key"] as string | undefined);
    await sleep(SLOW_STEP_MS);
  }
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ path: url, call: callsByPath[url] }));
});
await new Promise<void>((resolve) => target.listen(0, "127.0.0.1", resolve));
const port = (target.address() as { port: number }).port;

function startWorkerProcess(): ChildProcess {
  // Starts node directly, because killing a wrapper would leave the real process running.
  return spawn(process.execPath, ["--import", "tsx", "src/index.ts"], { cwd: serverRoot, stdio: "inherit" });
}

async function waitFor(check: () => boolean | Promise<boolean>, what: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

const step = (id: string) => ({
  id,
  name: id,
  type: "http_request",
  config: { method: "POST", url: `http://127.0.0.1:${port}/${id}` },
});

const definition = workflowDefinitionSchema.parse({
  steps: [step("first"), step("slow"), step("last")],
  edges: [
    { from: "first", to: "slow" },
    { from: "slow", to: "last" },
  ],
});

await startQueue();

const [workflow] = await db.insert(workflows).values({ name: "Crash test", webhookToken: crypto.randomUUID() }).returning();
const [version] = await db.insert(workflowVersions).values({ workflowId: workflow.id, versionNumber: 1, definition }).returning();

const firstWorker = startWorkerProcess();
const { run } = await createRun({ workflowId: workflow.id, versionId: version.id, triggerType: "manual", triggerData: {} });

await waitFor(() => callsByPath["/slow"] === 1, "the slow step to start");
firstWorker.kill("SIGKILL");
await new Promise((resolve) => firstWorker.once("exit", resolve));
console.log("Killed the first worker during the slow step");

const secondWorker = startWorkerProcess();
await waitFor(async () => {
  const [row] = await db.select().from(runs).where(eq(runs.id, run.id));
  return row.status === "succeeded" || row.status === "failed";
}, "the run to finish");
secondWorker.kill("SIGKILL");

const [finalRun] = await db.select().from(runs).where(eq(runs.id, run.id));
const steps = await db.select().from(stepRuns).where(eq(stepRuns.runId, run.id));
const attemptsFor = (id: string) => steps.find((row) => row.stepId === id)?.attempt;

assert.equal(finalRun.status, "succeeded", `Run ended as ${finalRun.status}: ${finalRun.error}`);
assert.equal(callsByPath["/first"], 1, "The finished first step must not run again");
assert.equal(callsByPath["/slow"], 2, "The interrupted step runs again");
assert.equal(callsByPath["/last"], 1, "The last step runs once");
assert.equal(attemptsFor("slow"), 2);
assert.equal(keysForSlowStep[0], keysForSlowStep[1], "Both attempts must send the same idempotency key");
assert.equal(keysForSlowStep[0], `${run.id}:slow`);

console.log("PASS: calls", callsByPath, "idempotency key", keysForSlowStep[0]);

await db.delete(workflows).where(eq(workflows.id, workflow.id));
await boss.stop({ graceful: false });
await pool.end();
target.close();
process.exit(0);
