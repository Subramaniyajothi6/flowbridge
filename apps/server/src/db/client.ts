import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config.ts";
import * as schema from "./schema.ts";

// A small pool, because free database plans limit the number of connections.
export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });

// The database or the network can close a connection that is waiting unused. Without this
// listener that stops the whole server. The pool drops the broken connection and opens a new one when needed.
pool.on("error", (error) => {
  console.error("Database connection closed:", error.message);
});

export const db = drizzle(pool, { schema });
