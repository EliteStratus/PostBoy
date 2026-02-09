# PostBoy OAuth 2.0 Spec v1 — Gap Analysis

This document compares **PostBoy-oauth2-spec-v1.md** with the current implementation and lists gaps (missing or differing behavior).

---

## Summary

| Area | Spec | Current | Gap severity |
|------|------|---------|--------------|
| Grant types | PKCE, Device Code, Client Credentials (Relay) | PKCE, Client Credentials (direct), Manual | **High** – Device missing; Relay vs direct CC |
| Client secret | Never in browser | Stored in request auth for Client Credentials | **High** – Security |
| Token storage | IndexedDB, keyed by workspace + env + config id | In request/collection JSON (file/state) | **Medium** |
| OAuth config model | OAuthConfig + TokenSet, id, relay, device fields | RequestAuth with flat oauth2* fields | **Medium** |
| Token status UX | Active/Expired/Missing, expiry, last obtained | Only "•••••••• (Bearer)" | **Medium** |
| Clear Token / Attach toggle / Reveal+Copy | Required | Not implemented | **Medium** |
| Callback route | `/oauth/callback` | `/oauth-callback.html` | **Low** |
| PKCE extras | audience, resource, extraAuthParams, extraTokenParams | extraParams only in code, not in UI | **Low** |
| Error messages | State mismatch, CORS, invalid_client, etc. | Generic / console | **Medium** |
| Auth inheritance at execution | Resolve Request→Folder→Collection→Workspace | Not resolved; inherit = no header | **High** |
| Replace Authorization prompt | Show when request has existing Auth header | Not implemented | **Low** |

---

## 1. Grant Types

### Spec (§3, §4.1)
- **Authorization Code (PKCE)** (default) ✅
- **Device Code** ❌
- **Client Credentials (Relay)** ❌ (spec: server-side only, no client secret in browser)

### Current
- **Access Token (manual)** – not in spec (acceptable extra)
- **Authorization Code (PKCE)** ✅
- **Client Credentials** – implemented as **direct** (Token URL + Client ID + **Client Secret** in browser)

### Gaps
1. **Device Authorization Grant (Device Code)** is not implemented (spec §9):
   - No Device Authorization URL, device code request, user_code/verification_uri UI, or polling.
2. **Client Credentials via Relay** is not implemented (spec §8):
   - Spec requires a Relay URL; client secret must **never** be in the browser.
   - Current flow sends client secret from the browser to the token endpoint; this contradicts spec §5 (“Never store Client Secret in browser”).

---

## 2. Data Model

### Spec (§4.1 – OAuthConfig)
- `id` (stable, for storage keying)
- `grantType`: `authorization_code_pkce` | `device_code` | `client_credentials_relay`
- Common: `tokenUrl`, `clientId`, `scope`
- PKCE: `authorizationUrl`, `redirectUri`, `audience`, `resource`, `extraAuthParams`, `extraTokenParams`
- Device: `deviceAuthorizationUrl`, `devicePollIntervalSec`, `extraDeviceParams`
- Relay: `relayUrl`, `relayProfile` (no client secret)

### Spec (§4.2 – TokenSet)
- `access_token`, `token_type`, `expires_in`, `expires_at` (epoch ms), `refresh_token`, `scope`, `id_token`, `obtained_at`

### Current (RequestAuth)
- No `id` for OAuth config.
- Grant type: `manual` | `authorization_code` | `client_credentials`.
- PKCE: auth URL, token URL, client ID, scope, callback URL; **no** `audience`, `resource`, `extraAuthParams` / `extraTokenParams` in UI (code has `extraParams` in `buildAuthorizationUrl` only).
- No Device fields: `deviceAuthorizationUrl`, `devicePollIntervalSec`, `extraDeviceParams`.
- No Relay fields: `relayUrl`, `relayProfile`; instead `oauth2ClientSecret` (spec forbids).
- Token: `oauth2Token`, `oauth2RefreshToken`, `oauth2ExpiresAt` (ISO string). No `token_type`, `id_token`, `obtained_at`, or epoch `expires_at`.

### Gaps
- Add/align model with spec: config `id`, Relay and Device fields, optional PKCE extras, TokenSet shape (token_type, expires_at, obtained_at, id_token) if persisting tokens separately.

---

## 3. Storage & Security

### Spec (§5)
- **IndexedDB** (preferred) for tokens; key by `workspaceId + environmentId + oauthConfig.id`.
- **Never store Client Secret in browser.**
- sessionStorage only for PKCE verifier and state; clear after callback.
- “Clear Token” removes TokenSet from storage.

### Current
- Tokens live in **request/collection JSON** (file system / in-memory state), not IndexedDB.
- No workspace/environment/config-id keying for OAuth tokens.
- **Client secret is stored** in request auth for Client Credentials (spec violation).
- PKCE state/verifier in sessionStorage ✅; cleared after use ✅.
- No “Clear Token” action.

### Gaps
1. Implement token storage in **IndexedDB** with keys as per spec (or document why request-scoped storage is chosen).
2. **Remove** client secret from browser: implement **Client Credentials via Relay** only (§8).
3. Implement **Clear Token** and ensure it removes the stored TokenSet (and any in-request token display).

---

## 4. Applying OAuth to Requests (§6)

### Spec
- Resolve auth via **inheritance**: Request → Folder → Collection → Workspace Default.
- Substitute variables in config.
- Set `Authorization: <token_type> <access_token>` (default Bearer).
- If request already has `Authorization`, show prompt: “OAuth will replace existing Authorization header.” (default: replace).

### Current
- **Inheritance is not resolved at execution time.** `buildRequest(request, environment)` uses `request.auth` as-is; if `type === 'inherit'` no header is added. There is no walk up Folder → Collection → Workspace to find an OAuth (or other) config.
- Variables are substituted in URL/headers/body ✅; auth token is substituted ✅.
- token_type is not used (always Bearer) ✅ for default.
- No prompt when the request already has an `Authorization` header; OAuth simply overwrites.

### Gaps
1. **Resolve OAuth (and auth) inheritance** when building the request: walk Request → Folder → Collection → Workspace and use the first non-inherit auth config.
2. Optional: **Prompt** when the request already has an `Authorization` header and OAuth would replace it.

---

## 5. UX (§3)

### Spec
- **Token Status:** Active / Expired / Missing, expiry time, last obtained.
- **Actions:** Get Token, Refresh Token (when refresh_token available), **Clear Token**.
- **Attach Token to Request** toggle (default ON).
- **Copy token** behind a “Reveal” step; no secrets in logs.

### Current
- No token status (Active/Expired/Missing); no expiry time or “last obtained”.
- Get Token ✅; Refresh Token ✅; **Clear Token** ❌.
- No “Attach Token to Request” toggle (token is always attached when present).
- No Reveal + Copy for token; token shown as “•••••••• (Bearer)” only.

### Gaps
1. Add **Token Status** (Active/Expired/Missing) and display **expiry** (and optionally last obtained).
2. Add **Clear Token** action.
3. Add **Attach Token to Request** toggle (default ON).
4. Add **Reveal** + **Copy** for token value, with no secrets in logs.

---

## 6. PKCE (§7)

### Spec
- state, code_verifier, code_challenge (S256) ✅
- Optional: audience, resource, extraAuthParams, extraTokenParams.
- Callback: validate state, exchange code, store TokenSet, compute expires_at.
- Errors: state mismatch, CORS, invalid_client / invalid_grant with clear messages.

### Current
- PKCE generation and auth URL ✅; token exchange in opener after callback ✅.
- `buildAuthorizationUrl` supports `extraParams` but UI does not expose **audience**, **resource**, or **extraAuthParams** / **extraTokenParams**.
- Callback page is **`/oauth-callback.html`** (spec says `/oauth/callback`).
- State validation: if state not in sessionStorage, exchange is not performed ✅; no explicit “State mismatch” message in UI.
- No CORS-specific or invalid_client/invalid_grant messaging in UI.

### Gaps
1. Optional: Expose **audience**, **resource**, **extraAuthParams**, **extraTokenParams** in UI (or document that extraParams is sufficient).
2. Align callback path with spec (e.g. `/oauth/callback`) or document choice of `/oauth-callback.html`.
3. **Error handling:** Show explicit messages for: state mismatch, “Token endpoint blocked by CORS”, and provider errors (invalid_client, invalid_grant, etc.).

---

## 7. Client Credentials via Relay (§8)

### Spec
- **Relay only:** POST to `relayUrl` with JSON: `grant_type`, `token_url`, `client_id`, `scope`, `relay_profile`.
- Relay returns TokenSet; no client secret in browser.
- Relay must be allowlisted, use e.g. `X-PostBoy-Relay-Key`, rate limit, no token bodies in logs.

### Current
- Client Credentials is **direct**: browser sends client_id + client_secret to token URL. No relay.

### Gaps
1. Implement **Client Credentials (Relay)** grant:
   - Add **Relay URL** (required) and **Relay Profile** (optional).
   - “Get Token” sends POST to relay with token_url, client_id, scope, relay_profile (no secret).
   - Store returned TokenSet in browser (per spec storage).
2. Remove or clearly deprecate **direct** Client Credentials with client secret in browser to comply with spec security rules.

---

## 8. Device Authorization Grant (§9)

### Spec
- Device Authorization URL, Token URL, Client ID, Scope.
- Request device code (POST); show user_code, “Open verification page”, countdown.
- Poll token endpoint with device_code until success or expiry; handle `interval`, `slow_down`, `authorization_pending`, `expired_token`.

### Current
- Not implemented.

### Gaps
1. Implement **Device Code** flow:
   - Config: `deviceAuthorizationUrl`, `tokenUrl`, `clientId`, `scope` (and optional device params).
   - Step 1: POST to device auth URL → get device_code, user_code, verification_uri, expires_in, interval.
   - Step 2: UI with user_code (copy), “Open verification page”, countdown.
   - Step 3: Poll token URL with `grant_type=urn:ietf:params:oauth:grant-type:device_code`, device_code, client_id; respect interval/slow_down; stop on success or expiry/cancel.
   - Store TokenSet on success.
2. Error handling: CORS message; “Authorization declined” when appropriate.

---

## 9. Refresh Token (§10)

### Spec
- If TokenSet has refresh_token, show Refresh; POST refresh_token grant; on failure mark token expired and require re-auth. Note that some providers require client auth for refresh.

### Current
- Refresh button when refresh_token + token URL exist ✅; refresh request implemented ✅.
- On failure, no structured “mark expired / require re-auth” or clear suggestion to re-login.

### Gaps
1. On refresh failure: **mark token as expired** in UI and show clear “Re-login required” (or similar) message.

---

## 10. Callback (§11)

### Spec
- Route: `/oauth/callback`; parse code, state, error, error_description; validate state; exchange; close popup or navigate back.
- Default **popup**; if blocked, fallback to same-tab with clear messaging.

### Current
- Callback at **`/oauth-callback.html`**; parses code, state, error (and error_description could be parsed). Token exchange is done in **opener** via postMessage ✅.
- No same-tab fallback or “popup blocked” messaging.

### Gaps
1. Consider renaming/adding route to match spec (`/oauth/callback`) or document `/oauth-callback.html`.
2. Add **popup-blocked** detection and fallback (same-tab redirect with clear message).

---

## 11. CORS (§12)

### Spec
- On token endpoint fetch failure, show: “Token endpoint blocked by CORS.”

### Current
- Generic error or console; no CORS-specific message.

### Gaps
1. **Detect** token-endpoint fetch failure (e.g. type or network) and show the spec message when CORS is the likely cause (and optionally suggest Relay for future).

---

## 12. Acceptance Criteria (§13) — Checklist

| Criterion | Status |
|-----------|--------|
| User can obtain token using PKCE and attach to requests | ✅ Partial (attach works; no IndexedDB/spec storage) |
| User can obtain token using Device Code and attach | ❌ Not implemented |
| User can obtain token using Client Credentials via Relay and attach | ❌ Not implemented (direct CC only) |
| Tokens persist locally across reloads (IndexedDB) | ⚠️ Tokens persist in request/collection, not IndexedDB |
| Clear Token removes stored tokens immediately | ❌ No Clear Token |
| state and PKCE verifier transient only, validated | ✅ |
| UI shows token status (active/expired) and expiry time | ❌ Only masked token |
| Error messages actionable (redirect, CORS, invalid_client, invalid_grant) | ❌ Generic only |

---

## 13. Implementation Checklist (§14) — Status

| Item | Status |
|------|--------|
| Add OAuth 2.0 to Authorization dropdown | ✅ |
| Create OAuthPanel UI with grant type selector + forms | ✅ Partial (no Device, no Relay; has Manual) |
| Implement PKCE utils (code_verifier, code_challenge S256) | ✅ |
| Implement /oauth/callback route | ✅ As /oauth-callback.html |
| Implement Device Code flow UI + polling | ❌ |
| Implement Relay client for client credentials | ❌ |
| Implement token storage in IndexedDB + scoped keys | ❌ |
| Apply OAuth tokens to requests via normalized request builder | ✅ (no inheritance resolution) |
| Add tests (state, expiry, header injection) | ❌ |

---

## Recommended order to close gaps

1. **Security / spec alignment**
   - Replace direct Client Credentials with **Client Credentials (Relay)** and stop storing client secret in the browser.
2. **Auth inheritance**
   - Resolve OAuth (and general auth) inheritance at request execution (Request → Folder → Collection → Workspace).
3. **Device Code**
   - Implement Device Authorization Grant (config, UI, polling, errors).
4. **Storage & UX**
   - IndexedDB token storage with spec keying (or document current approach).
   - Token status (Active/Expired/Missing), expiry, Clear Token, Attach toggle, Reveal+Copy.
5. **Errors & polish**
   - State mismatch, CORS, invalid_client/invalid_grant messages; callback path and popup-blocked behavior; refresh failure handling.

If you want, the next step can be a concrete implementation plan (e.g. “Phase 1: Relay + inheritance”) or patches for a specific gap.
