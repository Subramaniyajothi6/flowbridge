import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config.ts";
import * as schema from "./schema.ts";

// A small pool, because free database plans limit the number of connections.
export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });

export const db = drizzle(pool, { schema });
