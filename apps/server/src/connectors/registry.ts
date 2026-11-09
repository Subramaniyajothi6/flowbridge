import { gmail } from "./gmail.ts";
import { googleSheets } from "./google-sheets.ts";
import { slack } from "./slack.ts";
import { stripe } from "./stripe.ts";
import type { Connector, ConnectorAction } from "./types.ts";

export const connectors: Record<string, Connector> = {
  [slack.id]: slack,
  [googleSheets.id]: googleSheets,
  [gmail.id]: gmail,
  [stripe.id]: stripe,
};

// Object.hasOwn stops names like "toString" from matching built-in properties.
export function getConnector(id: string): Connector | undefined {
  return Object.hasOwn(connectors, id) ? connectors[id] : undefined;
}

export function getAction(connectorId: string, actionId: string): ConnectorAction | undefined {
  const connector = getConnector(connectorId);
  return connector && Object.hasOwn(connector.actions, actionId) ? connector.actions[actionId] : undefined;
}
