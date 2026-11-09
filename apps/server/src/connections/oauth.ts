import { config } from "../config.ts";

// Google supplies short-lived access tokens and a long-lived refresh token.
export const oauthProviders = {
  google: {
    name: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    // These two ask Google to include a refresh token every time.
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
  },
};

export type OAuthProviderName = keyof typeof oauthProviders;

export type OAuthTokens = { accessToken: string; refreshToken?: string; expiresAt: number };

// The provider has withdrawn access, so the user has to connect again.
export class ReconnectNeededError extends Error {}

export function isProviderConfigured(name: OAuthProviderName): boolean {
  const provider = oauthProviders[name];
  return Boolean(provider.clientId && provider.clientSecret);
}

export function oauthRedirectUri(): string {
  const base = config.PUBLIC_URL || `http://localhost:${config.PORT}`;
  return `${base.replace(/\/$/, "")}/api/connections/oauth/callback`;
}

export function buildAuthorizeUrl(name: OAuthProviderName, scopes: string[], state: string): string {
  const provider = oauthProviders[name];
  const params = new URLSearchParams({
    client_id: provider.clientId as string,
    redirect_uri: oauthRedirectUri(),
    response_type: "code",
    scope: scopes.join(" "),
    state,
    ...provider.extraAuthorizeParams,
  });
  return `${provider.authorizeUrl}?${params}`;
}

export function exchangeCodeForTokens(name: OAuthProviderName, code: string): Promise<OAuthTokens> {
  return requestTokens(name, { grant_type: "authorization_code", code, redirect_uri: oauthRedirectUri() });
}

export function refreshAccessToken(name: OAuthProviderName, refreshToken: string): Promise<OAuthTokens> {
  return requestTokens(name, { grant_type: "refresh_token", refresh_token: refreshToken });
}

async function requestTokens(name: OAuthProviderName, fields: Record<string, string>): Promise<OAuthTokens> {
  const provider = oauthProviders[name];

  const response = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...fields,
      client_id: provider.clientId as string,
      client_secret: provider.clientSecret as string,
    }),
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, any>;

  if (body.error === "invalid_grant") {
    throw new ReconnectNeededError(`${provider.name} access has expired or was removed`);
  }
  if (!response.ok || !body.access_token) {
    throw new Error(`${provider.name} did not issue a token (status ${response.status})`);
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + Number(body.expires_in) * 1000,
  };
}
