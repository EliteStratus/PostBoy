# PostBoy OAuth 2.0 Functional Spec (v1)
**Scope:** Implement OAuth 2.0 support in PostBoy for the following grant types:
1) **Authorization Code + PKCE** (browser-first)  
2) **Client Credentials (via Relay)** (server-side token exchange; no DB)  
3) **Device Authorization Grant (Device Code)** (browser-first)

> **Constraints:** No database. No PostBoy user authentication required. Tokens stored locally in the browser only.  
> **Hosting:** Cloudflare Pages. Cross-origin requests (including OAuth token and API calls) use the app’s built-in proxy at `/proxy` (see Deployment guide).

---

## 1) Goals

- Enable users to obtain OAuth tokens and attach them to requests as `Authorization: Bearer <token>`.
- Support the three grant types listed above with clear UX and safe defaults.
- Provide an “OAuth 2.0” Authorization pane that works per-request and supports **inheritance** (Folder → Collection → Workspace default).
- Keep secrets out of browser storage wherever possible (notably client secrets).

---

## 2) Non‑Goals (v1)

- No team/shared token storage.
- No database-backed persistence.
- No implicit flow.
- No Resource Owner Password Credentials (password grant).
- No mTLS, `private_key_jwt`, or other advanced client auth.
- No server-side request execution engine (separate feature).

---

## 3) UX Overview

### Authorization dropdown options (relevant)
- Inherit from Parent
- No Auth
- Bearer Token
- Basic Auth
- API Key
- **OAuth 2.0**  ✅ (this spec)

### OAuth 2.0 panel sections
1. **Grant Type** selector:
   - Authorization Code (PKCE) (default)
   - Device Code
   - Client Credentials (Relay)
2. **Provider Settings** (inputs vary by grant type)
3. **Token Status** (Active/Expired/Missing, expiry time, last obtained)
4. **Actions**:
   - Get Token
   - Refresh Token (only if refresh_token available and grant supports it)
   - Clear Token
5. **Attach Token to Request** toggle (default ON)

### UX requirements
- Clear, actionable error messages (CORS, redirect mismatch, invalid_client, invalid_grant, etc.).
- No secrets printed to logs.
- Provide Copy-to-clipboard buttons for token fields only behind a small “Reveal” step.

---

## 4) Data Model

### 4.1 OAuth config
```ts
type OAuthGrantType = "authorization_code_pkce" | "device_code" | "client_credentials_relay";

type OAuthConfig = {
  id: string;                  // stable id for storage keying
  grantType: OAuthGrantType;

  // Common
  tokenUrl: string;
  clientId: string;
  scope?: string;              // space-delimited

  // PKCE (Auth Code)
  authorizationUrl?: string;
  redirectUri?: string;        // default derived from app origin + /oauth/callback
  audience?: string;           // optional provider-specific
  resource?: string;           // optional provider-specific
  extraAuthParams?: Record<string, string>;   // optional
  extraTokenParams?: Record<string, string>;  // optional

  // Device Code
  deviceAuthorizationUrl?: string;
  devicePollIntervalSec?: number; // optional override
  extraDeviceParams?: Record<string, string>; // optional

  // Client Credentials via Relay
  relayUrl?: string;           // e.g. https://<worker>/oauth/token
  relayProfile?: string;       // which secret set to use (maps to env vars server-side)
};
```

### 4.2 Token set
```ts
type TokenSet = {
  access_token: string;
  token_type: string;          // usually "Bearer"
  expires_in?: number;
  expires_at?: number;         // computed epoch ms
  refresh_token?: string;
  scope?: string;
  id_token?: string;           // optional (OIDC)
  obtained_at?: number;        // epoch ms
};
```

---

## 5) Storage & Security (No DB)

### Storage location
- Use **IndexedDB** (preferred). `localStorage` acceptable for MVP if needed.
- Tokens are stored **client-side only**.

### Storage keying
- Key by: `workspaceId + environmentId + oauthConfig.id`
- Do not store tokens globally unless user explicitly chooses “Use across environments” (out of scope v1; default OFF).

### Security rules
- **Never store Client Secret in browser**.
- Use `sessionStorage` for transient values:
  - PKCE verifier
  - OAuth state
- Clear transient values after callback completes or fails.
- “Clear Token” removes TokenSet immediately from storage.

---

## 6) Applying OAuth to Requests

When OAuth 2.0 is active and “Attach Token” is ON:

1. Resolve auth config via inheritance:
   - Request → Folder → Collection → Workspace Default
2. Resolve variables in config fields (e.g., `{{clientId}}`, `{{tokenUrl}}`).
3. Attach header:
   - `Authorization: Bearer <access_token>`
   - use `token_type` if provided (default “Bearer”)
4. If request already has `Authorization`, show prompt:
   - “OAuth will replace existing Authorization header.” (default: replace)

---

## 7) Grant Type 1 — Authorization Code + PKCE (Required)

### Inputs
- Authorization URL (required)
- Token URL (required)
- Client ID (required)
- Scope (optional)
- Redirect URI (auto; editable only in “Advanced”)
- Optional: audience/resource/extra params

### Flow
1. Generate:
   - `state` (cryptographically random)
   - PKCE `code_verifier` + `code_challenge` (S256)
2. Open authorize URL with:
   - `response_type=code`
   - `client_id`
   - `redirect_uri`
   - `scope`
   - `state`
   - `code_challenge`
   - `code_challenge_method=S256`
   - plus optional params (audience/resource/extraAuthParams)
3. On `/oauth/callback`:
   - Validate returned `state`
   - Exchange code at token endpoint (POST x-www-form-urlencoded):
     - `grant_type=authorization_code`
     - `client_id`
     - `code`
     - `redirect_uri`
     - `code_verifier`
     - plus optional extraTokenParams
4. Store TokenSet, compute `expires_at = now + expires_in*1000`.

### Error handling
- State mismatch → hard fail, show “State mismatch; login response rejected.”
- Token endpoint CORS blocked → show “Token endpoint blocked by CORS. Try Relay mode (optional).”
- invalid_client / invalid_grant → show provider response summary.

---

## 8) Grant Type 2 — Client Credentials via Relay (Required)

### Rationale
Client Credentials requires client secret. Browser apps cannot keep secrets safely, so token exchange must occur server-side.

### Inputs
- Relay URL (required)
- Token URL (required) *(used by relay)*
- Client ID (required) *(used by relay)*
- Scope (optional)
- Relay Profile (optional selector)

### Relay contract (HTTP)
**POST** `{relayUrl}` with JSON:
```json
{
  "grant_type": "client_credentials",
  "token_url": "https://provider/token",
  "client_id": "xxx",
  "scope": "a b c",
  "relay_profile": "default"
}
```

Relay responds with TokenSet JSON (same fields as provider), or error:
```json
{ "error": "invalid_client", "error_description": "..." }
```

### Relay requirements (security)
- Must be allowlisted:
  - Allow only configured `token_url` domains
- Require a simple shared header secret (no user auth) e.g.:
  - `X-PostBoy-Relay-Key: <env>`
- Rate limit and log metadata (no token bodies in logs).

> **No DB**: relay uses environment variables only.

### UI behavior
- “Get Token” calls relay.
- Store TokenSet locally in browser.
- Show error messages from relay cleanly.

---

## 9) Grant Type 3 — Device Authorization Grant (Device Code) (Required)

### Inputs
- Device Authorization URL (required)
- Token URL (required)
- Client ID (required)
- Scope (optional)

### Flow
1. Request device code (POST x-www-form-urlencoded):
   - `client_id`
   - `scope`
   - plus optional extraDeviceParams
2. Response includes:
   - `device_code`
   - `user_code`
   - `verification_uri` (and/or `verification_uri_complete`)
   - `expires_in`
   - optional `interval`
3. UI shows:
   - User code (large, copy button)
   - “Open verification page” button
   - Countdown timer to expiry
4. Poll token endpoint until success or expiry (POST x-www-form-urlencoded):
   - `grant_type=urn:ietf:params:oauth:grant-type:device_code`
   - `device_code`
   - `client_id`
5. On success, store TokenSet.

### Polling rules
- Default poll interval: provider `interval` if provided, else **5 seconds**
- Stop polling on:
  - `expired_token`
  - expiry timer reached
  - user cancels
- Handle `authorization_pending` and `slow_down` per RFC:
  - on `slow_down`, increase interval by +5 seconds

### Error handling
- CORS blocked → show “Token endpoint blocked by CORS. Consider using Relay mode if allowed.”
- user denied → show “Authorization declined.”

---

## 10) Refresh Token Support (Optional, recommended)

If TokenSet includes `refresh_token`:
- Show **Refresh** button.
- Refresh request (POST x-www-form-urlencoded):
  - `grant_type=refresh_token`
  - `client_id`
  - `refresh_token`
  - optional `scope`
- If refresh fails, mark token expired and require re-auth.

> Some providers require client authentication for refresh; if so, PKCE refresh may fail in browser. Provide clear error and suggest re-login.

---

## 11) Redirect / Callback Implementation

### Callback route
- Implement `/oauth/callback` route/page.
- On load:
  - parse query params: `code`, `state`, `error`, `error_description`
  - validate state
  - perform token exchange
  - close popup or navigate back to originating page

### Popup vs same-tab
- Default: **popup** to avoid losing current state
- If popup blocked, fall back to same-tab with clear messaging.

---

## 12) CORS Strategy

### Reality
Some providers block token endpoint calls from browsers.

### Current implementation
- Cross-origin token and API requests use the app’s **proxy** at `/proxy` (Cloudflare Pages Function). The client POSTs `{ url, method, headers, body }` as JSON; the proxy forwards the request and returns the response. See `docs/DEPLOYMENT.md` (Proxy section).

### Behavior
- Detect fetch failure and display specific message:
  - “Token endpoint blocked by CORS.”

### Optional enhancement (future)
- Allow PKCE and Device flows to use relay for token exchange as well (still no DB).

---

## 13) Acceptance Criteria

- [ ] User can obtain token using PKCE and attach it to requests.
- [ ] User can obtain token using Device Code and attach it to requests.
- [ ] User can obtain token using Client Credentials via Relay and attach it to requests.
- [ ] Tokens persist locally across reloads (IndexedDB).
- [ ] Clear Token removes stored tokens immediately.
- [ ] `state` and PKCE verifier are stored only transiently and validated.
- [ ] UI shows token status (active/expired) and expiry time.
- [ ] Error messages are actionable (redirect mismatch, CORS, invalid_client, invalid_grant).

---

## 14) Implementation Checklist (Cursor)

- [ ] Add `OAuth 2.0` to Authorization dropdown.
- [ ] Create `OAuthPanel` UI with grant type selector + forms.
- [ ] Implement PKCE utils (`code_verifier`, `code_challenge` S256).
- [ ] Implement `/oauth/callback` route.
- [ ] Implement Device Code flow UI + polling.
- [ ] Implement Relay client for client credentials.
- [ ] Implement token storage in IndexedDB + scoped keys.
- [ ] Apply OAuth tokens to requests via normalized request builder.
- [ ] Add tests for:
  - state validation
  - token expiry calculation
  - header injection rules

---
