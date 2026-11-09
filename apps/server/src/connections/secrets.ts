import { config } from "../config.ts";
import { decryptText, encryptText, parseKeyRing } from "./crypto.ts";

const keyRing = parseKeyRing(config.ENCRYPTION_KEYS);

export function encryptSecret(plainText: string): string {
  return encryptText(plainText, keyRing);
}

export function decryptSecret(stored: string): string {
  return decryptText(stored, keyRing);
}

export type Credentials =
  | { type: "token"; token: string }
  | { type: "oauth"; accessToken: string; refreshToken: string; expiresAt: number };

export function sealCredentials(credentials: Credentials): string {
  return encryptSecret(JSON.stringify(credentials));
}

export function openCredentials(stored: string): Credentials {
  return JSON.parse(decryptSecret(stored)) as Credentials;
}
