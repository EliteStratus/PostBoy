# Postman-Lite — `pm` Scripting Compatibility Spec (pm-lite)
**Purpose:** Define a **Postman-compatible scripting subset** (“pm-lite”) that enables running common Postman collections (including HMAC/CryptoJS-based flows) in our **Web UI, no-install, DB-free** tool.

> This spec is intended to be **merged with / referenced by the NetPost spec** in Cursor.

---

## 1) Scope & Goals

### Goals
- Provide a **safe, deterministic, sandboxed** scripting environment supporting a **compatible subset** of Postman’s `pm.*` API.
- Maximize real-world compatibility for:
  - **Pre-request scripts** (variable setup, request mutation, signing)
  - **Post-response scripts** (tests/assertions, extraction into variables)
- Support common Postman idioms used in API authentication (notably **CryptoJS**).

### Non-goals (Phase 1)
- Full Postman runtime parity
- Async network calls from scripts (`pm.sendRequest`)
- Arbitrary module loading via `require()` (only a strict whitelist)
- File system access from scripts
- Long-running scripts / background tasks

---

## 2) Legal / Licensing & Positioning (Important)

### What we *will not* do
- Copy Postman proprietary source code
- Reverse-engineer Postman internals
- Market the tool as “fully Postman-compatible” or a “drop-in replacement”

### What we *will* do
- Implement our own API surface with compatible **function names and semantics** for a subset.
- Use permissive, third-party libraries where appropriate (e.g., **crypto-js** is MIT-licensed).

### Recommended wording
- Internal: **pm-lite — Postman-compatible scripting subset**
- External: “Supports a Postman-compatible scripting API for common use cases.”

---

## 3) Execution Model

### Script hooks
1. **Pre-Request Script**
   - Runs before request templating + sending
   - May set variables and mutate request

2. **Post-Response Script**
   - Runs after receiving response
   - May run tests/assertions and extract variables for subsequent requests

### Where scripts run
- In-browser **Web Worker** sandbox (no DOM access)
- Synchronous execution for v1 (no `await` required)

### Safety controls
- Per-script timeout (default **300ms**, configurable)
- Max logs per step (default **64KB**)
- Blocked globals: `window`, `document`, unrestricted `fetch`, `XMLHttpRequest`, storage APIs
- No arbitrary network access from scripts (Phase 1)

---

## 4) Variable Resolution & `replaceIn()`

### Template syntax
- `{{varName}}`
- Dynamic vars:
  - `{{$guid}}` (required)
  - `{{$timestamp}}` (recommended)
  - `{{$randomInt}}` (recommended)
  - `{{$randomUUID}}` (recommended)

### Resolution order
1. **Runtime** (per run; mutable)
2. **Environment**
3. **Collection variables**
4. **Global (optional)**

### Required function
- `pm.variables.replaceIn(str: string): string`
  - Replaces `{{var}}` and supported dynamic vars

---

## 5) pm-lite API Contract

### 5.1 Variables

#### Environment scope
- `pm.environment.get(key: string): string | undefined`
- `pm.environment.set(key: string, value: string): void`
- `pm.environment.unset(key: string): void` *(optional but recommended)*

#### Collection scope
- `pm.collectionVariables.get(key: string): string | undefined`
- `pm.collectionVariables.set(key: string, value: string): void`
- `pm.collectionVariables.unset(key: string): void` *(optional but recommended)*

#### Merged view + runtime
- `pm.variables.get(key: string): string | undefined`  
  (reads merged scope per resolution order)
- `pm.variables.set(key: string, value: string): void`  
  (writes to **runtime** scope only)
- `pm.variables.replaceIn(str: string): string` *(required)*

> Note: Postman also has `pm.globals` — we can alias it to a “global” file if needed later. Not required for v1.

---

### 5.2 Request (read/write)

The request object exposed to scripts must allow mutation prior to send.

- `pm.request.method: string`
- `pm.request.url: string` *(raw URL string)*
- `pm.request.headers: Record<string, string>` *(normalized to a map; preserve case when writing out if needed)*
- `pm.request.body.raw: string` *(raw string, typically JSON)*

#### Compatibility rule (critical)
If scripts assign:
- `pm.request.body = "..."`  
We must treat it as:
- `pm.request.body.raw = "..."`

This improves compatibility with real-world Postman scripts.

---

### 5.3 Response (read-only)

- `pm.response.code: number`
- `pm.response.headers: Record<string, string>`
- `pm.response.text(): string`
- `pm.response.json(): any` *(throws on invalid JSON; provide clear error)*

Optional convenience
- `pm.response.size?: number`
- `pm.response.responseTime?: number`

---

### 5.4 Tests & Assertions

#### Test registration
- `pm.test(name: string, fn: () => void): void`

#### Expect API (minimal matchers)
- `pm.expect(value).toEqual(expected)`
- `pm.expect(value).toBeTruthy()`
- `pm.expect(value).toContain(substrOrItem)`
- `pm.expect(value).toMatch(regex)` *(recommended)*
- `pm.expect(value).toBeGreaterThan(n)` *(recommended)*
- `pm.expect(value).toBeLessThan(n)` *(recommended)*

#### Status assertion sugar
- `pm.response.to.have.status(code: number): void`

> Implementation note: Do NOT import full Chai in v1 unless you must. A small matcher set covers most scripts.

---

### 5.5 Logging
- `console.log(...args)`
- `console.warn(...args)` *(optional)*
- `console.error(...args)` *(optional)*

Logs are captured per-request step and shown in UI + optionally written to run report.

---

## 6) `require()` Support (Strict Whitelist)

### Why
Common Postman collections use:
- `const CryptoJS = require('crypto-js')`

### Contract
- Provide `require(name: string)` in the sandbox that only resolves allowlisted modules.
- If module is not allowlisted, throw a clear error.

### Allowlist (v1)
- `crypto-js` (MIT)

### CryptoJS minimum support
- `CryptoJS.SHA256(message)`
- `CryptoJS.HmacSHA256(message, key)`
- `CryptoJS.enc.Base64.stringify(wordArray)`
- `CryptoJS.enc.Utf8.parse(str)`

> Implementation: bundle `crypto-js` at build time and expose it through the sandbox resolver.

---

## 7) Script Examples (Conformance Tests)

### 7.1 Pre-request: timestamp + signature (CryptoJS)
```js
const CryptoJS = require('crypto-js');

const ts = Date.now().toString();
pm.environment.set('time', ts);

const body = pm.variables.replaceIn(pm.request.body.raw || '');
const bodyHash = CryptoJS.SHA256(body);
const bodyHashB64 = CryptoJS.enc.Base64.stringify(bodyHash);

const secret = pm.environment.get('apiSecret');
const msg = pm.request.method + '\n' + pm.request.url + '\n' + ts + '\n' + bodyHashB64;
const sig = CryptoJS.HmacSHA256(msg, secret);
const sigB64 = CryptoJS.enc.Base64.stringify(sig);

pm.environment.set('signature', sigB64);
```

### 7.2 Post-response: tests + extraction
```js
pm.test('status is 200', () => {
  pm.response.to.have.status(200);
});

const data = pm.response.json();
pm.test('has transactionId', () => {
  pm.expect(!!data.transactionId).toBeTruthy();
});

pm.environment.set('transactionId', data.transactionId);
```

### 7.3 Compatibility: mutate body via `pm.request.body`
```js
let b = pm.request.body.raw;
b = pm.variables.replaceIn(b);
pm.request.body = b; // must map to pm.request.body.raw
```

---

## 8) Conformance Requirements (Must Pass)

- Pre-request script can:
  - set env vars
  - mutate request URL/headers/body.raw
  - compute hashes and HMAC via CryptoJS require
- `pm.variables.replaceIn` correctly replaces `{{vars}}` and `{{$guid}}`
- Post-response script can:
  - assert status code via `pm.response.to.have.status`
  - parse JSON via `pm.response.json()`
  - set variables for downstream requests
- Scripts are sandboxed and time-limited; runaway scripts are terminated.

---

## 9) Integration Notes (for NetPost spec)

When merging with NetPost spec:
- Treat this as the **authoritative scripting contract**.
- Ensure the runner executes in order:
  1) Build request model
  2) Run pre-request script
  3) Apply templating (replaceIn) to URL/headers/body
  4) Send request
  5) Run post-response script
  6) Persist env/runtime changes

---

## 10) Future Extensions (Phase 1.1+)

- Add `pm.globals` support (global variables file)
- Add `pm.iterationData` for data-driven runs (CSV/JSON)
- Add allowlisted `require('uuid')` or provide `pm.helpers.uuid()`
- Consider `pm.sendRequest` with strict allowlist (security review required)

---
