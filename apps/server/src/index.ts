import { buildServer } from "./api/server.ts";
import { config } from "./config.ts";
import { loadCustomApps } from "./connectors/custom-apps-store.ts";
import { pool } from "./db/client.ts";
import { boss, startQueue } from "./engine/queue.ts";
import { startWorker } from "./engine/worker.ts";

const runsApi = config.RUN_MODE === "all" || config.RUN_MODE === "api";
const runsWorker = config.RUN_MODE === "all" || config.RUN_MODE === "worker";

await startQueue();
await loadCustomApps();

const stopSweep = runsWorker ? await startWorker() : undefined;
const app = runsApi ? buildServer() : undefined;
if (app) await app.listen({ port: config.PORT, host: "0.0.0.0" });

async function shutDown(): Promise<void> {
  stopSweep?.();
  await app?.close();
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
