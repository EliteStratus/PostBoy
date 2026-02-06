
# Postman-Lite (Web UI, No Install) — Implementation + Deployment Spec (DB-Free)

> **Decision:** Web UI only, **no local installation**, **no database**, **no backend storage**.  
> All user data lives in the user-selected local workspace folder (File System Access API) or exported ZIP/JSON.

---

## 0. Core Principles

1. No database of any kind.
2. No server-side persistence of user data.
3. Static web deployment only.
4. All collections/environments stored locally on disk.
5. Git-friendly deterministic JSON structure.

---

## 1. Tech Stack

- React + TypeScript
- Vite
- Monaco Editor
- Zustand
- Tailwind CSS
- File System Access API
- Web Workers (script sandbox)
- WebCrypto (AES-GCM for secrets)
- Browser `fetch()` for HTTP execution

---

## 2. Workspace Layout

```
<workspace-root>/
  .apiclient/
    workspace.json
    index.json
    runs/
  environments/
    dev.env.json
    stage.env.json
  collections/
    Orders/
      collection.json
      requests/
        Create Order.request.json
      folders/
        Admin/
          folder.json
          requests/
            Cancel Order.request.json
```

---

## 3. Functional Scope (MVP)

- Run API requests
- Organize requests into collections & folders
- Pre-request & post-response scripting
- Sequential collection runner
- Local disk persistence
- Postman v2.1 import
- ZIP fallback for unsupported browsers

---

## 4. Scripts

- JavaScript sandbox via Web Worker
- `pm-lite` API
- `require('crypto-js')` supported
- Execution time limits enforced

---

## 5. Deployment

- Static hosting (Cloudflare Pages)
- HTTPS required
- No runtime backend services
- Optional Docker for dev & CI only

---

## 6. Phase 2 (Planned)

- GitHub integration
- Repo sync
- PR workflow

---
