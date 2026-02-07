# Deployment Guide

PostBoy is a static web application hosted on **Cloudflare Pages**. This guide covers all deployment options.

## Scripts Reference

| Command | Description |
|--------|-------------|
| `npm run build` | Build and deploy (runs `tsc`, `vite build`, then `wrangler pages deploy`). Default workflow for local deploy. |
| `npm run build:only` | Build only (no deploy). Use for CI or when deploying separately. |
| `npm run deploy` | Deploy only (requires existing `dist/` from a previous build). |
| `npm run dev` | Local development server at `http://localhost:5173`. |
| `npm run preview` | Preview production build locally at `http://localhost:4173`. |

## Option A: Local build + deploy (Wrangler CLI)

From your machine:

```bash
npm run build
```

This builds the app and deploys to Cloudflare Pages. Requires:

- Wrangler CLI (included via project): `npx wrangler login` once
- Cloudflare account and Pages project named `postboy`

Alternatively: `./scripts/deploy.sh` (same as `npm run build`).

## Option B: Cloudflare Dashboard – Connect to Git

1. Go to [Cloudflare Pages](https://pages.cloudflare.com)
2. Create a project → **Connect to Git**
3. Select your repository
4. Build settings:
   - **Build command:** `npm run build:only`
   - **Build output directory:** `dist`
   - **Root directory:** (leave empty)
5. Save and deploy. Push to `main` (or your production branch) to trigger deploys.

**Note:** Use `build:only` so Cloudflare runs only the build; Cloudflare then uploads `dist/`. Do not use `npm run build` here (that would try to run Wrangler deploy in Cloudflare’s environment without your credentials).

## Option C: Cloudflare Dashboard – Upload assets

1. Locally: `npm run build:only`
2. In Cloudflare Pages: Create project → **Upload assets**
3. Upload the `dist/` folder. Your site is live (e.g. `https://postboy.pages.dev`).

## Option D: GitHub Actions (CI/CD)

The repo includes `.github/workflows/deploy.yml` which:

- Runs on push to `main` or `master`
- Runs `npm run build:only`, then deploys `dist/` via Cloudflare Pages action

**Required GitHub secrets:**

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## SPA routing

`public/_redirects` is copied into `dist/` so all routes serve `index.html` on Cloudflare Pages.

## Custom domain

In Cloudflare Pages: Project → **Custom domains** → Add domain. See `docs/CUSTOM_DOMAIN_SETUP.md` for details.

## Verification

Test the production build locally before deploying:

```bash
npm run build:only
npm run preview
```

Open `http://localhost:4173`.

## Troubleshooting

- **Build fails:** Node.js 18+, `npm install`, then `npm run build:only`
- **404 on routes:** Ensure `public/_redirects` exists with `/*    /index.html   200`
- **File System API:** Requires HTTPS or localhost; otherwise the app uses the in-memory/ZIP fallback.

## Environment variables

None required for the app; it runs entirely in the browser.
