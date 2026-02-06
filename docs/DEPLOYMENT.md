# Deployment Guide

PostBoy is a static web application hosted on **Cloudflare Pages**. This guide covers deployment and alternatives.

## Prerequisites

- Built application (`npm run build`)
- Git repository (optional, for CI/CD)
- Cloudflare account

## Cloudflare Pages (Recommended)

### Option A: Cloudflare Dashboard

1. Go to [Cloudflare Pages](https://pages.cloudflare.com)
2. Click "Create a project" → "Connect to Git"
3. Select your repository
4. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Click "Save and Deploy"

### Option B: Wrangler CLI

```bash
npm install -g wrangler
wrangler login
wrangler pages deploy dist --project-name=postboy
```

Or use the project script:

```bash
npm run deploy
```

### Option C: Upload Assets

1. Run `npm run build` locally
2. Go to Cloudflare Pages → Create project → Upload assets
3. Drag and drop the `dist` folder

### SPA Routing

The `public/_redirects` file is copied into `dist` and ensures all routes serve `index.html` on Cloudflare Pages.

## Continuous Deployment

The `.github/workflows/deploy.yml` file is configured for automatic deployment to Cloudflare Pages on push to `main`.

Required secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Custom Domain

In Cloudflare Pages: Project → Custom domains → Add domain.

## Build Verification

Before deploying:

```bash
npm run build
npm run preview
```

Visit `http://localhost:4173` to test the production build locally.

## Environment Variables

No environment variables are required for PostBoy. It runs entirely in the browser.

## Troubleshooting

### Build Fails

- Ensure Node.js 18+ is installed
- Run `npm install`
- Check for TypeScript errors: `npm run build`

### 404 on Client-Side Routes

- Ensure `public/_redirects` is present so it is copied to `dist`
- Rule should be: `/*    /index.html   200`

### File System API Not Working

- Expected when not on HTTPS or localhost; the app uses ZIP fallback automatically.
