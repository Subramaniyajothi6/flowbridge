import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// The .env file sits at the root of the repository.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is missing. Copy .env.example to .env and fill it in."),
  ENCRYPTION_KEYS: z.string().min(1, "ENCRYPTION_KEYS is missing. See .env.example."),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // The address people reach this app on. Leave empty when running locally.
  PUBLIC_URL: z.string().optional(),
  RUN_MODE: z.enum(["all", "api", "worker"]).default("all"),
  PORT: z.coerce.number().default(3000),
  ALLOW_PRIVATE_URLS: z.stringbool().default(false),
  // How long a worker owns a run. Must be longer than the longest single step.
  LEASE_SECONDS: z.coerce.number().default(90),
  // How long the queue waits before it treats a job as lost.
  JOB_EXPIRE_SECONDS: z.coerce.number().default(120),
  // How often the worker looks for runs that nobody is working on.
  SWEEP_SECONDS: z.coerce.number().default(30),
  // How often the worker checks for schedules and polls that are due.
  TRIGGER_TICK_SECONDS: z.coerce.number().default(20),
  // The most webhook deliveries one workflow accepts in a minute.
  WEBHOOK_MAX_PER_MINUTE: z.coerce.number().default(120),
});

export const config = envSchema.parse(process.env);
