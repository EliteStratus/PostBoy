# Deploy to Dev Environment First

## Current Status

**Not deployed yet** - Ready to deploy to dev environment.

## Deploy to Dev on Cloudflare Pages

### Option 1: Create Dev Branch and Deploy

```bash
# Create and switch to dev branch
git checkout -b dev

# Commit all changes
git add .
git commit -m "Initial commit - ready for dev deployment"

# Push to remote
git push -u origin dev
```

Then in Cloudflare Pages:
1. Go to https://pages.cloudflare.com
2. Create a new project: **postboy-dev**
3. Connect to your Git repository
4. Set production branch to `dev` (or leave as `main` for separate dev project)
5. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
6. Deploy

### Option 2: Manual Dev Deployment

```bash
# Build the project
npm run build

# Deploy to dev project (requires wrangler CLI)
npm install -g wrangler
wrangler login
wrangler pages deploy dist --project-name=postboy-dev
```

### Option 3: Use GitHub Actions (Automatic)

If you have GitHub Actions set up:
1. Create a `dev` branch
2. Push to `dev` branch
3. The `.github/workflows/deploy-dev.yml` will automatically deploy to `postboy-dev` project

## Cloudflare Pages Setup for Dev

1. **Create Dev Project:**
   - Project name: `api-client-dev` (or any simple name you prefer)
   - Production branch: `dev` (or `main` if you want separate projects)
   - Build command: `npm run build`
   - Build output directory: `dist`

2. **Preview Deployments:**
   - Cloudflare Pages automatically creates preview deployments for PRs
   - Each push to `dev` creates a new preview

3. **Custom Domain (Optional):**
   - Add `dev.yourdomain.com` for dev environment
   - Or use the default `api-client-dev.pages.dev` URL (or your chosen name)

## After Dev Deployment

Once dev is working:
1. Test all features
2. Verify File System Access API works
3. Test ZIP import/export
4. Then deploy to production (`main` branch)

## Quick Deploy Command

```bash
# Build and deploy to dev
npm run build && wrangler pages deploy dist --project-name=api-client-dev
```

## Check Deployment Status

Visit your Cloudflare Pages dashboard to see:
- Build logs
- Deployment status
- Preview URLs
- Custom domains
