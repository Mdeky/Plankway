/**
 * Sign-in with an OAuth 2.0 / OpenID Connect provider: authorization code flow with PKCE
 * and a nonce. We only ask for the `openid` scope, so the provider tells us nothing but a
 * stable user id: no e-mail address, no name.
 */
import type { Env } from './db.ts';

export type ProviderId = 'google';

export interface Provider {
  id: ProviderId;
  clientId: string;
  clientSecret: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  issuers: readonly string[];
}

/** Providers with credentials configured on this deployment. */
export function configuredProviders(env: Env): Provider[] {
  const out: Provider[] = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    out.push({
      id: 'google',
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorizeEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      issuers: ['https://accounts.google.com', 'accounts.google.com'],
    });
  }
  return out;
}

const encoder = new TextEncoder();

export function base64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
}

export function authorizeUrl(
  provider: Provider,
  p: { redirectUri: string; state: string; nonce: string; codeChallenge: string },
): string {
  const url = new URL(provider.authorizeEndpoint);
  url.search = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: 'openid',
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

export class OAuthError extends Error {
  override name = 'OAuthError';
}

/**
 * Trades the code for an ID token and returns the user id (`sub`). The token comes
 * straight from the provider's token endpoint over TLS, so per OpenID Connect Core 3.1.3.7
 * its issuer, audience, expiry and nonce are checked instead of its signature.
 */
export async function exchangeCode(
  provider: Provider,
  p: { code: string; redirectUri: string; verifier: string; nonce: string; now: number },
  fetcher: typeof fetch,
): Promise<string> {
  const res = await fetcher(provider.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: p.code,
      redirect_uri: p.redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: p.verifier,
    }).toString(),
  });
  if (!res.ok) throw new OAuthError(`token endpoint answered ${res.status}`);
  const body = (await res.json()) as { id_token?: unknown };
  if (typeof body.id_token !== 'string') throw new OAuthError('no id_token');

  const parts = body.id_token.split('.');
  if (parts.length !== 3) throw new OAuthError('malformed id_token');
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(fromBase64Url(parts[1]!)) as Record<string, unknown>;
  } catch {
    throw new OAuthError('unreadable id_token');
  }
  const aud = claims.aud;
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!provider.issuers.includes(String(claims.iss))) throw new OAuthError('wrong issuer');
  if (!audiences.includes(provider.clientId)) throw new OAuthError('wrong audience');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < p.now) throw new OAuthError('expired');
  if (claims.nonce !== p.nonce) throw new OAuthError('wrong nonce');
  if (typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 255) throw new OAuthError('no subject');
  return claims.sub;
}
