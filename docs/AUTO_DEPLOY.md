# Auto-Deployment Setup

PostBoy is configured for automatic deployment to Cloudflare Pages.

## Auto-Deployment Methods

### 1. Build + Deploy Script (Recommended for Local)

Use the combined command:
```bash
npm run build:deploy
```

This will:
1. Build the project
2. Automatically deploy to Cloudflare Pages

### 2. Deploy Script

Use the shell script:
```bash
./scripts/deploy.sh
```

### 3. GitHub Actions (Automatic on Push)

If you have GitHub Actions set up with secrets:
- Push to `main` branch → Auto-deploys
- Push to `dev` branch → Auto-deploys to dev (if configured)

### 4. Manual Deploy

If you just want to deploy without building:
```bash
npm run deploy
```

## Configuration

### Package.json Scripts

- `npm run build` - Build only
- `npm run build:deploy` - Build + Deploy (auto-deploy)
- `npm run deploy` - Deploy only (requires existing build)

### GitHub Actions

The `.github/workflows/deploy.yml` file automatically:
- Builds on push to `main`
- Deploys to Cloudflare Pages
- No manual intervention needed

## Requirements

For auto-deployment to work:
- ✅ Wrangler CLI installed: `npm install -g wrangler`
- ✅ Logged in: `wrangler login`
- ✅ Project exists on Cloudflare Pages

## Quick Deploy

```bash
# One command to build and deploy
npm run build:deploy
```

## Notes

- The `build:deploy` script always runs build first, then deploy
- If build fails, deployment is skipped
- Deployment takes ~30 seconds
- Your site will be live at: `https://postboy.pages.dev`
