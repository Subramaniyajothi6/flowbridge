import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

export const MINIMUM_PASSWORD_LENGTH = 12;

// Scrypt is built into Node and is deliberately slow, which makes guessing expensive.
// Each password has its own random salt, so equal passwords get different hashes.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function isPasswordCorrect(password: string, storedHash: string): Promise<boolean> {
  const [, saltHex, keyHex] = storedHash.split("$");
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}

// A hash of nothing in particular. Checking against it when an email is unknown
// takes as long as a real check, so timing does not reveal who has an account.
export const UNKNOWN_USER_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(KEY_LENGTH)}`;

// For an Administrator to pass on to a new member, who is then asked to change it.
export function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}
