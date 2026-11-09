import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Credentials are encrypted with AES-256-GCM. GCM also detects any change to
// the stored value, so a tampered credential fails instead of decrypting to rubbish.
//
// Each stored value records which key encrypted it. To change keys, add a new
// key at the front of the list and keep the old one so old values still open.

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

export type KeyRing = { currentKeyId: string; keys: Map<string, Buffer> };

// Expects "keyId:base64Key,olderKeyId:base64Key". The first key encrypts new values.
export function parseKeyRing(text: string): KeyRing {
  const keys = new Map<string, Buffer>();

  for (const entry of text.split(",").map((item) => item.trim()).filter(Boolean)) {
    const separator = entry.indexOf(":");
    const keyId = entry.slice(0, separator);
    const key = Buffer.from(entry.slice(separator + 1), "base64");
    if (separator < 1 || !/^[a-zA-Z0-9]+$/.test(keyId)) throw new Error("Each encryption key needs a simple id");
    if (key.length !== KEY_BYTES) throw new Error(`Encryption key "${keyId}" must be ${KEY_BYTES} bytes`);
    keys.set(keyId, key);
  }

  const [currentKeyId] = keys.keys();
  if (!currentKeyId) throw new Error("No encryption keys were provided");
  return { currentKeyId, keys };
}

export function encryptText(plainText: string, ring: KeyRing): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, ring.keys.get(ring.currentKeyId) as Buffer, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const parts = [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url"));
  return [ring.currentKeyId, ...parts].join(".");
}

export function decryptText(stored: string, ring: KeyRing): string {
  const [keyId, iv, authTag, encrypted] = stored.split(".");
  const key = ring.keys.get(keyId);
  if (!key) throw new Error(`The encryption key "${keyId}" is not available`);

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
