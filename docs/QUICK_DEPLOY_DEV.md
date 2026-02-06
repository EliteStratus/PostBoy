# Quick Deploy to Dev - Cloudflare Pages

## Status: ✅ Ready to Deploy (Not deployed yet)

## Default URL: postboy.pages.dev

You'll get a free Cloudflare Pages URL: `https://postboy.pages.dev`

To use a custom domain like `dev-postboy.dev` later, you'll need to:
1. Purchase/register the domain first
2. Then follow `CUSTOM_DOMAIN_SETUP.md`

## Fastest Way: Cloudflare Dashboard

### Step 1: Build Locally (Already Done)
```bash
npm run build
```
✅ Build is ready in `dist/` folder

### Step 2: Deploy via Cloudflare Dashboard

1. **Go to Cloudflare Pages**
   - Visit: https://pages.cloudflare.com
   - Sign in to your Cloudflare account

2. **Create Dev Project**
   - Click "Create a project"
   - Choose "Upload assets" (fastest for first deploy)
   - Project name: `postboy`

3. **Upload Build**
   - Drag and drop the `dist/` folder
   - Or click to browse and select the `dist/` folder
   - Click "Deploy site"

4. **Your Dev Site is Live!**
   - URL will be: `https://postboy.pages.dev` (free, works immediately)
   - Deployment takes ~30 seconds

### Step 3: Set Up Git Integration (Optional, for future updates)

After first deployment:
1. Go to your project settings
2. Click "Connect to Git"
3. Connect your repository
4. Set production branch to `dev` or `main`
5. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`

## Alternative: Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy to dev
wrangler pages deploy dist --project-name=postboy
```

## What Happens After Deployment

- ✅ Site will be live at `https://postboy.pages.dev` (free Cloudflare subdomain)
- ✅ HTTPS enabled automatically
- ✅ File System Access API will work (requires HTTPS)
- ✅ To add custom domain later: purchase domain first, then see `CUSTOM_DOMAIN_SETUP.md`
- ✅ All features ready to test

## Next Steps After Dev Deployment

1. Test the application
2. Verify File System Access API works
3. Test creating collections/requests
4. Test Postman import
5. Once verified, deploy to production
