import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.ts";

await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle") });
await pool.end();
console.log("Database is up to date");
