import type { z } from "zod";

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  body?: string;
};

// Sends a request with the connection's credentials added.
// Connector code never sees the credentials themselves.
export type ConnectorRequest = (url: string, options?: RequestOptions) => Promise<any>;

export type ActionContext = {
  request: ConnectorRequest;
  // The same for every attempt of a step, so a service can recognise a repeat.
  idempotencyKey: string;
};

export type ConnectorAction = {
  description: string;
  input: z.ZodType;
  run: (context: ActionContext, input: any) => Promise<unknown>;
};

// Checks the input type of run against the input schema.
export function defineAction<Schema extends z.ZodType>(action: {
  description: string;
  input: Schema;
  run: (context: ActionContext, input: z.output<Schema>) => Promise<unknown>;
}): ConnectorAction {
  return action;
}

export type ConnectorAuth =
  | { type: "token"; label: string; help: string; pattern: RegExp; patternMessage: string }
  | { type: "oauth"; provider: "google"; scopes: string[] };

// Everything FlowBridge needs to know about a service.
// To add a service, write one of these and add it to registry.ts.
export type Connector = {
  id: string;
  name: string;
  auth: ConnectorAuth;
  // Credentials are only ever sent to these hosts.
  allowedHosts: string[];
  // Makes a harmless call to prove the connection works, and names the account.
  test: (context: ActionContext) => Promise<{ account: string }>;
  actions: Record<string, ConnectorAction>;
};
