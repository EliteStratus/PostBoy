/**
 * OAuth 2.0 helpers: PKCE, authorization URL, token exchange, client credentials, refresh.
 * No client_secret required for Authorization Code with PKCE (public clients).
 */

const PKCE_VERIFIER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const PKCE_VERIFIER_LENGTH = 64;

/** Generate a cryptographically random code_verifier (43–128 chars per RFC 7636). */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(PKCE_VERIFIER_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => PKCE_VERIFIER_CHARS[b % PKCE_VERIFIER_CHARS.length]).join('');
}

/** Base64url encode (no padding, + -> -, / -> _). */
function base64UrlEncode(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Generate S256 code_challenge from code_verifier. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
}

export interface PKCEStatePayload {
  tokenUrl: string;
  clientId: string;
  codeVerifier: string;
  redirectUri: string;
}

const OAUTH2_STATE_PREFIX = 'pb_oauth2_';

/** Store PKCE state in sessionStorage for callback page to retrieve. */
export function storePKCEState(state: string, payload: PKCEStatePayload): void {
  try {
    sessionStorage.setItem(OAUTH2_STATE_PREFIX + state, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/** Retrieve and remove PKCE state (one-time use). */
export function consumePKCEState(state: string): PKCEStatePayload | null {
  try {
    const key = OAUTH2_STATE_PREFIX + state;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    return JSON.parse(raw) as PKCEStatePayload;
  } catch {
    return null;
  }
}

/** Build authorization URL for Authorization Code (PKCE) flow. */
export function buildAuthorizationUrl(params: {
  authUrl: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  codeChallenge: string;
  state: string;
  extraParams?: Record<string, string>;
}): string {
  const url = new URL(params.authUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  if (params.scope) url.searchParams.set('scope', params.scope);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  if (params.extraParams) {
    for (const [k, v] of Object.entries(params.extraParams)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

/** Generate a short random state value. */
export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

/** Exchange authorization code for tokens (PKCE, no client_secret). */
export async function exchangeCodeForTokens(params: {
  tokenUrl: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    client_id: params.clientId,
  });
  const res = await fetch(params.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${res.statusText}. ${text}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const access_token = data.access_token;
  if (typeof access_token !== 'string') {
    throw new Error('Token response missing access_token');
  }
  return {
    access_token,
    token_type: typeof data.token_type === 'string' ? data.token_type : undefined,
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    refresh_token: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
  };
}

/** Fetch a URL; when in browser and target is cross-origin, use the app proxy to avoid CORS. */
async function fetchTokenEndpoint(tokenUrl: string, init: RequestInit): Promise<Response> {
  if (typeof window === 'undefined') {
    return fetch(tokenUrl, init);
  }
  const target = new URL(tokenUrl);
  const origin = window.location.origin;
  if (target.origin === origin) {
    return fetch(tokenUrl, init);
  }
  // Token endpoint is on another origin — use proxy with POST JSON (same as API requests) for all OAuth2
  const bodyStr = typeof init.body === 'string' ? init.body : '';
  const proxyPayload = {
    url: tokenUrl,
    method: 'POST',
    tokenRequest: '1',
    body: bodyStr,
  };
  return fetch(new URL('/proxy', origin).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(proxyPayload),
    credentials: 'omit',
  });
}

/** Client Credentials flow: get access token. Uses proxy when token URL is cross-origin to avoid CORS. */
export async function getTokenClientCredentials(params: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });
  if (params.scope) body.set('scope', params.scope);
  const bodyStr = body.toString();
  const res = await fetchTokenEndpoint(params.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: bodyStr,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Client credentials token failed: ${res.status} ${res.statusText}. ${text}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const access_token = data.access_token;
  if (typeof access_token !== 'string') {
    throw new Error('Token response missing access_token');
  }
  return {
    access_token,
    token_type: typeof data.token_type === 'string' ? data.token_type : undefined,
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
  };
}

/** Refresh access token using refresh_token. */
export async function refreshAccessToken(params: {
  tokenUrl: string;
  refreshToken: string;
  clientId: string;
  clientSecret?: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  });
  if (params.clientSecret) body.set('client_secret', params.clientSecret);
  const res = await fetch(params.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${res.statusText}. ${text}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const access_token = data.access_token;
  if (typeof access_token !== 'string') {
    throw new Error('Token response missing access_token');
  }
  return {
    access_token,
    token_type: typeof data.token_type === 'string' ? data.token_type : undefined,
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    refresh_token: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
  };
}

/** Compute expires_at ISO string from expires_in (seconds from now). */
export function computeExpiresAt(expiresInSeconds: number | undefined): string | undefined {
  if (expiresInSeconds == null || expiresInSeconds <= 0) return undefined;
  const d = new Date();
  d.setSeconds(d.getSeconds() + expiresInSeconds);
  return d.toISOString();
}

/** Return true if token is expired or will expire in the next 60 seconds. */
export function isTokenExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now() + 60_000; // 1 min buffer
  return now >= expiry;
}

/** Get the default OAuth 2.0 callback URL for this app (same origin). */
export function getDefaultCallbackUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/oauth-callback.html`;
}

// --- Callback registration for Authorization Code flow (popup) ---
type OAuth2PendingCallback = (tokens: TokenResponse) => void;
const pendingCallbacks = new Map<string, OAuth2PendingCallback>();

export function registerOAuth2Callback(state: string, cb: OAuth2PendingCallback): void {
  pendingCallbacks.set(state, cb);
}

export function getOAuth2Callback(state: string): OAuth2PendingCallback | undefined {
  const cb = pendingCallbacks.get(state);
  pendingCallbacks.delete(state);
  return cb;
}
