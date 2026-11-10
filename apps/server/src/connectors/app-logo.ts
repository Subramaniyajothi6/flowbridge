import { assertPublicAddress } from "../engine/steps/http-step.ts";

// Logos are stored inside FlowBridge as data addresses, so showing one never tells
// an outside service which apps this workspace uses.
// SVG is not accepted, because an SVG file can contain code.

const MAX_LOGO_BYTES = 100_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"];

export const LOGO_PATTERN = /^data:(image\/(?:png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon));base64,([A-Za-z0-9+/]+=*)$/;

export function isValidLogo(logo: string): boolean {
  const match = LOGO_PATTERN.exec(logo);
  return match !== null && Buffer.from(match[2], "base64").length <= MAX_LOGO_BYTES;
}

export function decodeLogo(logo: string): { type: string; bytes: Buffer } | null {
  const match = LOGO_PATTERN.exec(logo);
  return match ? { type: match[1], bytes: Buffer.from(match[2], "base64") } : null;
}

// Where a site's icon usually is. An API address such as api.github.com rarely has one,
// so the main site (github.com) is tried as well.
export function logoAddresses(baseUrl: string): string[] {
  const { hostname } = new URL(baseUrl);
  const labels = hostname.split(".");
  const mainSite = labels.slice(-2).join(".");
  const hosts = [hostname, mainSite, `www.${mainSite}`];
  return [...new Set(hosts)].map((host) => `https://${host}/favicon.ico`);
}

// Some servers send icons with a general type, so the file name decides instead.
function imageType(contentType: string | null, url: URL): string | null {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (ACCEPTED_TYPES.includes(type)) return type;
  if (url.pathname.endsWith(".ico") && (type === "" || type === "application/octet-stream")) return "image/x-icon";
  return null;
}

async function readLimitedBytes(response: Response): Promise<Buffer | null> {
  if (!response.body) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_LOGO_BYTES) return null;
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Follows redirects one at a time, so that every address is checked before it is called.
async function fetchImage(address: string, allowPrivateUrls: boolean): Promise<string | null> {
  let url = new URL(address);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (url.protocol !== "https:") return null;
    if (!allowPrivateUrls) await assertPublicAddress(url);

    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "image/*" } });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) return null;

    const type = imageType(response.headers.get("content-type"), url);
    const bytes = type ? await readLimitedBytes(response) : null;
    return type && bytes && bytes.length > 0 ? `data:${type};base64,${bytes.toString("base64")}` : null;
  }
  return null;
}

// Returns null when no icon is found. An app works the same without one.
export async function findLogo(baseUrl: string, allowPrivateUrls: boolean): Promise<string | null> {
  for (const address of logoAddresses(baseUrl)) {
    try {
      const logo = await fetchImage(address, allowPrivateUrls);
      if (logo) return logo;
    } catch {
      // This place had no usable icon. The next one is tried.
    }
  }
  return null;
}
