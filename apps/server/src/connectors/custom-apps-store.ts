import { config } from "../config.ts";
import { db } from "../db/client.ts";
import { appLogos, customApps } from "../db/schema.ts";
import { findLogo } from "./app-logo.ts";
import { toConnector, type CustomAppDefinition } from "./custom-app.ts";
import { registerConnector } from "./registry.ts";

export function registerCustomApp(id: string, definition: CustomAppDefinition): void {
  registerConnector(toConnector(id, definition, { allowPrivateUrls: config.ALLOW_PRIVATE_URLS }));
}

// Runs at start-up, so that saved apps are ready before any workflow needs them.
export async function loadCustomApps(): Promise<void> {
  const rows = await db.select().from(customApps);
  for (const row of rows) registerCustomApp(row.id, row.definition);

  // Apps whose site had no icon when they were added get another try.
  // It runs in the background, so a slow site cannot delay start-up.
  const withLogo = new Set((await db.select({ id: appLogos.connectorId }).from(appLogos)).map((row) => row.id));
  void fillMissingLogos(rows.filter((row) => !withLogo.has(row.id)));
}

async function fillMissingLogos(rows: (typeof customApps.$inferSelect)[]): Promise<void> {
  for (const row of rows) {
    const logo = await findLogo(row.definition.baseUrl, config.ALLOW_PRIVATE_URLS);
    // Does nothing if a person chose a logo in the meantime.
    if (logo) await db.insert(appLogos).values({ connectorId: row.id, logo }).onConflictDoNothing();
  }
}
