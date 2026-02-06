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

### Build

```bash
npm run build
```

**Rule:** `npm run build` always builds and deploys to Cloudflare Pages. For a local build only (no deploy), use `npm run build:only`.

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

PostBoy is configured for **Cloudflare Pages** deployment.

### Quick Deploy to Cloudflare Pages

**Option 1: Dashboard (Recommended)**
1. Go to https://pages.cloudflare.com
2. Click "Create a project" → "Connect to Git"
3. Select your repository
4. Build settings:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Click "Save and Deploy"

**Option 2: Wrangler CLI**
```bash
npm install -g wrangler
wrangler login
wrangler pages deploy dist --project-name=postboy
```

**Option 3: Upload Assets**
1. Run `npm run build` locally
2. Go to Cloudflare Pages → Create project → Upload assets
3. Drag and drop the `dist` folder

See `docs/CLOUDFLARE_DEPLOY.md` for detailed instructions.

No backend configuration needed.

## License

ISC
