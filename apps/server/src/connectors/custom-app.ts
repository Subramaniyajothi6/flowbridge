import { z } from "zod";
import { resolveReferences, type ReferenceContext } from "../engine/references.ts";
import { assertPublicAddress } from "../engine/steps/http-step.ts";
import { defineAction, type Connector, type ConnectorAction, type RequestOptions } from "./types.ts";

// An Administrator can add an app from the Integrations page, by describing its web API.
// It becomes an ordinary connector, so it has the same encryption and safety rules as Slack.
// A custom app is only ever a set of web requests. It cannot run code.

const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;
const FIELD_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const WITHOUT_BODY = ["GET", "DELETE"];

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1]);
}

export function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function isValidJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

const path = z.string().trim().startsWith("/", "A path starts with /").max(300);

const actionSchema = z
  .object({
    name: z.string().trim().min(1, "Give each action a name").max(60),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path,
    fields: z.array(z.object({ name: z.string().regex(FIELD_NAME, "Field names use letters, numbers and underscores, starting with a letter"), required: z.boolean() })).max(30),
    // JSON, which can use {{field}}. Without one, the fields are sent as they are.
    bodyTemplate: z.string().trim().max(10_000).optional(),
  })
  .superRefine((action, context) => {
    const report = (message: string) => context.addIssue({ code: "custom", message: `${action.name}: ${message}` });
    const names = action.fields.map((field) => field.name);
    const required = action.fields.filter((field) => field.required).map((field) => field.name);

    if (new Set(names).size !== names.length) report("each field needs a different name");
    for (const name of placeholdersIn(action.path)) {
      if (!required.includes(name)) report(`the path uses {{${name}}}, so it must be a required field`);
    }
    if (action.bodyTemplate) {
      if (WITHOUT_BODY.includes(action.method)) report(`a ${action.method} request cannot have a body`);
      if (!isValidJson(action.bodyTemplate)) report("the body is not valid JSON");
      for (const name of placeholdersIn(action.bodyTemplate)) {
        if (!names.includes(name)) report(`the body uses {{${name}}}, which is not one of the fields`);
      }
    }
  });

export const customAppSchema = z
  .object({
    name: z.string().trim().min(1, "Give the app a name").max(60),
    baseUrl: z.url("Enter a full address, such as https://api.example.com").trim(),
    authType: z.enum(["bearer", "header", "basic"]),
    headerName: z.string().trim().max(60).optional(),
    // A harmless address that needs signing in, used by the Test button.
    testPath: path,
    actions: z.array(actionSchema).min(1, "Add at least one action").max(30),
  })
  .superRefine((app, context) => {
    const report = (message: string) => context.addIssue({ code: "custom", message });

    if (!slugify(app.name)) report("The app's name needs some letters or numbers");
    if (app.authType === "header" && !/^[A-Za-z][A-Za-z0-9-]*$/.test(app.headerName ?? "")) report("Enter the name of the header that carries the key");

    if (URL.canParse(app.baseUrl)) {
      const url = new URL(app.baseUrl);
      // Keys must not travel unencrypted.
      if (url.protocol !== "https:") report("The address must start with https://");
      if (url.username || url.password || url.search || url.hash) report("Use only the app's address, without sign-in details or anything after a ? or #");
    }

    const actionIds = app.actions.map((action) => slugify(action.name));
    if (actionIds.some((id) => !id)) report("Each action's name needs some letters or numbers");
    if (new Set(actionIds).size !== actionIds.length) report("Each action needs a different name");
  });

export type CustomAppDefinition = z.output<typeof customAppSchema>;
type CustomAction = CustomAppDefinition["actions"][number];

const fieldValue = z.union([z.string().min(1), z.number(), z.boolean(), z.array(z.unknown()), z.record(z.string(), z.unknown())]);

function inputSchemaFor(action: CustomAction) {
  return z.object(Object.fromEntries(action.fields.map((field) => [field.name, field.required ? fieldValue : fieldValue.optional()])));
}

function buildPath(template: string, input: Record<string, unknown>): string {
  // Encoded, so that a value cannot change which address is called.
  const encoded = Object.fromEntries(Object.entries(input).map(([name, value]) => [name, encodeURIComponent(String(value))]));
  return resolveReferences(template, encoded as unknown as ReferenceContext) as string;
}

function fieldsNotInPath(action: CustomAction, input: Record<string, unknown>): Record<string, unknown> {
  const inPath = placeholdersIn(action.path);
  return Object.fromEntries(Object.entries(input).filter(([name, value]) => !inPath.includes(name) && value !== undefined));
}

function buildBody(action: CustomAction, input: Record<string, unknown>): string {
  if (!action.bodyTemplate) return JSON.stringify(fieldsNotInPath(action, input));
  // A field left empty is left out, instead of failing.
  return JSON.stringify(resolveReferences(JSON.parse(action.bodyTemplate), input as unknown as ReferenceContext, "undefined"));
}

function toConnectorAction(baseUrl: string, action: CustomAction): ConnectorAction {
  return defineAction({
    description: `${action.method} ${action.path}`,
    input: inputSchemaFor(action),
    async run({ request, idempotencyKey }, input) {
      const values = input as Record<string, unknown>;
      const url = new URL(baseUrl + buildPath(action.path, values));
      const options: RequestOptions = { method: action.method, headers: { accept: "application/json" } };

      if (WITHOUT_BODY.includes(action.method)) {
        for (const [name, value] of Object.entries(fieldsNotInPath(action, values))) url.searchParams.set(name, String(value));
      } else {
        options.body = buildBody(action, values);
        options.headers = { ...options.headers, "content-type": "application/json", "idempotency-key": idempotencyKey };
      }

      const response = await request(url.toString(), options);
      // Later steps pick values out of an object, so anything else is wrapped in one.
      return response !== null && typeof response === "object" && !Array.isArray(response) ? response : { response };
    },
  });
}

function authDetails(app: CustomAppDefinition): Pick<Connector, "credentialHeaders"> & { label: string; help: string; pattern: RegExp; patternMessage: string } {
  if (app.authType === "basic") {
    return {
      label: "Email:API token",
      help: "Enter your email and API token with a colon between them, like you@example.com:your-token.",
      pattern: /^[^:\s]+:\S+$/,
      patternMessage: "Enter your email and API token with a colon between them",
      credentialHeaders: (secret) => ({ authorization: `Basic ${Buffer.from(secret).toString("base64")}` }),
    };
  }

  const anyKey = { pattern: /\S/, patternMessage: "Enter the API key" };
  if (app.authType === "header") {
    const headerName = app.headerName as string;
    return { ...anyKey, label: "API key", help: `Sent in the ${headerName} header.`, credentialHeaders: (secret) => ({ [headerName]: secret }) };
  }
  return { ...anyKey, label: "API token", help: "Sent as a bearer token." };
}

export function toConnector(id: string, app: CustomAppDefinition, options: { allowPrivateUrls: boolean }): Connector {
  const baseUrl = app.baseUrl.replace(/\/+$/, "");
  const { hostname } = new URL(baseUrl);
  const { credentialHeaders, ...tokenAuth } = authDetails(app);

  return {
    id,
    name: app.name,
    customHost: hostname,
    auth: { type: "token", ...tokenAuth },
    allowedHosts: [hostname],
    credentialHeaders,
    // Checked on every call, because an address can start pointing somewhere else later.
    checkBeforeSend: options.allowPrivateUrls ? undefined : assertPublicAddress,
    actions: Object.fromEntries(app.actions.map((action) => [slugify(action.name), toConnectorAction(baseUrl, action)])),

    async test({ request }) {
      await request(baseUrl + app.testPath, { headers: { accept: "application/json" } });
      return { account: app.name };
    },
  };
}
