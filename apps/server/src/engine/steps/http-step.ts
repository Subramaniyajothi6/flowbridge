import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { HttpRequestConfig } from "../definition.ts";

const TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 1_000_000;

export type HttpStepOptions = {
  allowPrivateUrls: boolean;
  // Lets the receiving service recognise a repeat if this step has to run again after a crash.
  idempotencyKey: string;
};

export type HttpStepOutput = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export async function runHttpStep(config: HttpRequestConfig, options: HttpStepOptions): Promise<HttpStepOutput> {
  const url = parseUrl(config.url);
  if (!options.allowPrivateUrls) await assertPublicAddress(url);

  const headers = new Headers(config.headers);
  if (config.method !== "GET" && !headers.has("idempotency-key")) {
    headers.set("idempotency-key", options.idempotencyKey);
  }

  const response = await fetch(url, {
    method: config.method,
    headers,
    body: buildBody(config, headers),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // A redirect could send the request to a private address after the check above.
    redirect: "error",
  });

  const text = await readLimitedText(response);
  const output = {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: parseBody(text, response.headers.get("content-type")),
  };

  if (!response.ok) throw new Error(`The server replied with status ${response.status}`);
  return output;
}

function parseUrl(value: unknown): URL {
  let url: URL;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error(`"${value}" is not a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https addresses are allowed");
  }
  return url;
}

function buildBody(config: HttpRequestConfig, headers: Headers): string | undefined {
  if (config.method === "GET" || config.body === undefined) return undefined;
  if (typeof config.body === "string") return config.body;
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return JSON.stringify(config.body);
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of response.body) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_RESPONSE_BYTES) throw new Error("The response is larger than the 1 MB limit");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseBody(text: string, contentType: string | null): unknown {
  if (!contentType?.includes("json")) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Workflow authors choose the URL, so without this check a workflow could
// reach databases and admin pages inside the server's own network.
const privateAddresses = new BlockList();
privateAddresses.addSubnet("0.0.0.0", 8, "ipv4");
privateAddresses.addSubnet("10.0.0.0", 8, "ipv4");
privateAddresses.addSubnet("100.64.0.0", 10, "ipv4");
privateAddresses.addSubnet("127.0.0.0", 8, "ipv4");
privateAddresses.addSubnet("169.254.0.0", 16, "ipv4");
privateAddresses.addSubnet("172.16.0.0", 12, "ipv4");
privateAddresses.addSubnet("192.168.0.0", 16, "ipv4");
privateAddresses.addAddress("::", "ipv6");
privateAddresses.addAddress("::1", "ipv6");
privateAddresses.addSubnet("fc00::", 7, "ipv6");
privateAddresses.addSubnet("fe80::", 10, "ipv6");

export function isPrivateAddress(address: string): boolean {
  return privateAddresses.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

async function assertPublicAddress(url: URL): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) ? [hostname] : (await lookup(hostname, { all: true })).map((item) => item.address);

  if (addresses.some(isPrivateAddress)) {
    throw new Error(`Requests to private network addresses are not allowed (${hostname})`);
  }
}
