# PostBoy

A UI-based API client that runs entirely in the browser with no backend or database. All data is stored locally using the File System Access API or exported as ZIP/JSON files.

## Features

- **No backend**: Runs entirely in the browser; no server or database
- **Local storage**: File System Access API for persistence; ZIP fallback when unsupported
- **Collections & folders**: Organize requests in a tree; resizable sidebar; run from a collection or a folder
- **Environments**: Variables with See/Hide (secrets), enabled for substitution; create, edit, delete, import and export (v2.1 JSON)
- **Collection Runner**: Tree of requests (Select All / Deselect All, Expand All / Collapse All), iterations and delay; results with Success (2xx), Failed (4xx/5xx/network), Attention (1xx/3xx); collapsible Requests and Results panels
- **Request editor**: Method, URL, headers, auth (None, Basic, Bearer, OAuth2, API Key), body; save-before-close prompt when closing a dirty tab; response and cookies preserved per tab
- **Cookies & session**: Requests sent with `credentials: 'include'`; cookies from auth responses (e.g. Set-Cookie) shown in Response Headers/Cookies; proxy forwards Cookie/Set-Cookie for cross-origin APIs
- **Pre/Post scripts**: JavaScript with pm-lite API in a Web Worker
- **Import**: v2.1 collection and environment JSON (file picker or drag-and-drop)
- **Export**: Export current or all environments (v2.1 JSON); export collection or folder from sidebar context menu (v2.1 collection JSON)
- **Monaco Editor**: JSON, XML, JavaScript editing with syntax highlighting
- **Response viewer**: Body, Headers, Cookies tabs; pretty-print, timing, size
- **UI**: Light/dark theme; resizable request/response split; context menus (Run, Export, Rename, Duplicate, Delete) with accent colors

## Tech Stack

- **React** + **TypeScript**
- **Vite** for build tooling
- **Zustand** for state management
- **Monaco Editor** for code editing
- **Tailwind CSS** for styling
- **File System Access API** for local storage
- **Web Workers** for script execution
- **WebCrypto** for secret encryption

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build and deploy

```bash
npm run build
```

Builds the app and deploys to Cloudflare Pages. For a local build only (e.g. for CI or preview), use `npm run build:only`. See `docs/DEPLOYMENT.md` for all options.

## Usage

1. **Open workspace**: Choose a folder (or create one) for your workspace
2. **Collections & folders**: Create collections and nested folders; add requests with method, URL, headers, auth, body
3. **Environments**: Add environments and variables; use See/Hide for secrets; only enabled variables are substituted in requests
4. **Run requests**: Run a single request from the editor, or open **Runner**, pick a collection (or run from a folder in the sidebar), select requests, then Run; view Success / Failed / Attention counts and clear results as needed
5. **Import**: Use **Import** (top nav) to add v2.1 collections and environments from JSON. **Export**: From **Environments**, use Export / Export all; from the sidebar, right-click a collection or folder and choose **Export** to download v2.1 JSON.

## Workspace Structure

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

## Browser Support

- **Chrome/Edge 86+**: Full File System Access API support
- **Firefox/Safari**: ZIP import/export mode (in-memory storage)

## Deployment

PostBoy deploys to **Cloudflare Pages**. From your machine, run `npm run build` to build and deploy. For Git-based or upload-based deployment, see **`docs/DEPLOYMENT.md`** for the full guide (scripts reference, dashboard setup, GitHub Actions, custom domain).

## License

ISC
