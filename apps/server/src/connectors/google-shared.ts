import type { ActionContext } from "./types.ts";

export const GOOGLE_IDENTITY_HOST = "openidconnect.googleapis.com";
export const GOOGLE_IDENTITY_SCOPES = ["openid", "email"];

// Works for every Google connection, and shows which account was connected.
export async function testGoogleConnection({ request }: ActionContext): Promise<{ account: string }> {
  const user = await request(`https://${GOOGLE_IDENTITY_HOST}/v1/userinfo`);
  return { account: user.email };
}
