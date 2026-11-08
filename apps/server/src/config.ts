import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// The .env file sits at the root of the repository.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is missing. Copy .env.example to .env and fill it in."),
  RUN_MODE: z.enum(["all", "api", "worker"]).default("all"),
  PORT: z.coerce.number().default(3000),
  ALLOW_PRIVATE_URLS: z.stringbool().default(false),
  // How long a worker owns a run. Must be longer than the longest single step.
  LEASE_SECONDS: z.coerce.number().default(90),
  // How long the queue waits before it treats a job as lost.
  JOB_EXPIRE_SECONDS: z.coerce.number().default(120),
  // How often the worker looks for runs that nobody is working on.
  SWEEP_SECONDS: z.coerce.number().default(30),
});

export const config = envSchema.parse(process.env);
