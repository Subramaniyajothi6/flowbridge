import { z } from "zod";
import { getAction } from "../connectors/registry.ts";
import type { ConnectorStepConfig } from "../engine/definition.ts";
import { openConnection } from "./client.ts";

export async function runConnectorStep(config: ConnectorStepConfig, idempotencyKey: string): Promise<unknown> {
  const action = getAction(config.connector, config.action);
  if (!action) throw new Error(`Unknown action "${config.connector}.${config.action}"`);

  // Checked here rather than when saving, because references are only filled in now.
  const parsed = action.input.safeParse(config.params);
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error));

  const { request } = await openConnection(config.connectionId, config.connector);
  return action.run({ request, idempotencyKey }, parsed.data);
}
