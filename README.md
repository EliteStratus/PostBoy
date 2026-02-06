# PostBoy

A Postman-like API client that runs entirely in the browser with no backend or database. All data is stored locally using the File System Access API or exported as ZIP/JSON files.

## Features

- ✅ **No Backend Required**: Runs entirely in the browser
- ✅ **Local File Storage**: Uses File System Access API for persistence
- ✅ **ZIP Fallback**: Works in browsers without File System Access API support
- ✅ **Collections & Folders**: Organize requests hierarchically
- ✅ **Environments**: Manage environment variables
- ✅ **Pre/Post Scripts**: JavaScript scripting with pm-lite API
- ✅ **Collection Runner**: Execute multiple requests sequentially
- ✅ **Postman Import**: Import Postman v2.1 collections and environments
- ✅ **Monaco Editor**: Syntax highlighting for JSON, XML, JavaScript
- ✅ **Response Viewer**: Pretty-print JSON, view headers, timing

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

1. **Open/Create Workspace**: Click "Open Workspace" to select a folder or create a new one
2. **Create Collections**: Add collections to organize your API requests
3. **Add Requests**: Create HTTP requests with methods, URLs, headers, and body
4. **Set Environments**: Create environments with variables for different configurations
5. **Run Requests**: Execute requests individually or run entire collections
6. **Import from Postman**: Import your existing Postman collections and environments

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
