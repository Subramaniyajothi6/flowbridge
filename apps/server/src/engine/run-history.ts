import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { workspace } from "../db/schema.ts";

// Removes the data that went through finished runs older than the workspace's history period:
// what started each run, and what each step received and returned.
// The runs themselves stay, with their status, errors and timing, so Analytics still counts them.
// Runs once a day. Returns how many runs were cleared.
export async function removeOldRunData(): Promise<number> {
  const [settings] = await db.select({ days: workspace.runHistoryDays }).from(workspace).where(eq(workspace.id, 1));
  if (!settings || settings.days <= 0) return 0;

  const result = await db.execute(sql`
    with cleared as (
      update runs
      set trigger_data = '{}'::jsonb, data_removed_at = now()
      where status in ('succeeded', 'failed')
        and data_removed_at is null
        and coalesce(finished_at, created_at) < now() - make_interval(days => ${settings.days})
      returning id
    ), steps as (
      update step_runs set input = null, output = null
      where run_id in (select id from cleared)
    )
    select count(*)::int as cleared from cleared`);

  return (result.rows[0] as { cleared: number }).cleared;
}
