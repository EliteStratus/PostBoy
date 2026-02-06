# Cloudflare Pages Deployment Guide

## Quick Deploy

### Option 1: Cloudflare Dashboard (Recommended)

1. **Go to Cloudflare Pages**
   - Visit https://pages.cloudflare.com
   - Sign in to your Cloudflare account

2. **Create a New Project**
   - Click "Create a project"
   - Choose "Connect to Git" (GitHub/GitLab/Bitbucket) or "Upload assets"

3. **If Connecting Git:**
   - Select your repository
   - Build settings:
     - **Framework preset**: Vite (or None)
     - **Build command**: `npm run build`
     - **Build output directory**: `dist`
     - **Root directory**: `/` (leave empty)
   - Click "Save and Deploy"

4. **If Uploading Assets:**
   - Run `npm run build` locally first
   - Drag and drop the `dist` folder
   - Your site will be live immediately

### Option 2: Wrangler CLI

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=postboy
```

### Option 3: GitHub Actions (Automatic)

The `.github/workflows/deploy.yml` file is configured for automatic deployment.

**Setup:**
1. Add secrets to your GitHub repository:
   - `CLOUDFLARE_API_TOKEN` - Get from Cloudflare Dashboard → My Profile → API Tokens
   - `CLOUDFLARE_ACCOUNT_ID` - Found in Cloudflare Dashboard URL or Workers & Pages settings

2. Push to `main` branch - deployment happens automatically

## Build Configuration

- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node Version**: 18+ (auto-detected)

## Important Notes

- ✅ Static site only - no server functions needed
- ✅ All routing handled client-side (SPA)
- ✅ `_redirects` file ensures all routes serve `index.html`
- ✅ No environment variables required
- ✅ HTTPS enabled by default on Cloudflare Pages

## Custom Domain (e.g., dev-postboy.dev)

1. Go to your project in Cloudflare Pages
2. Click "Custom domains"
3. Click "Set up a custom domain"
4. Enter: `dev-postboy.dev` (or your preferred subdomain)
5. If domain is in Cloudflare: DNS configured automatically
6. If external domain: Add CNAME record pointing to `postboy.pages.dev`
7. SSL certificate will be auto-provisioned (takes 1-5 minutes)

See `CUSTOM_DOMAIN_SETUP.md` for detailed instructions.

## Post-Deployment Checklist

- [ ] Test the application loads correctly
- [ ] Verify File System Access API works (Chrome/Edge)
- [ ] Test ZIP import/export fallback (other browsers)
- [ ] Test creating collections and requests
- [ ] Test Postman import functionality
- [ ] Verify environment variables work

## Troubleshooting

### Build Fails
- Ensure `package.json` has correct build script
- Check Node.js version (18+)
- Review build logs in Cloudflare Dashboard

### 404 Errors
- Verify `_redirects` file is in `dist/` folder
- Check that all routes redirect to `index.html`

### File System API Not Working
- This is expected - browsers require HTTPS
- Cloudflare Pages provides HTTPS automatically
- Users can use ZIP import/export as fallback

## Build Output

The `dist/` folder contains:
```
dist/
├── index.html
└── assets/
    ├── index-*.js (main bundle)
    ├── index-*.css (styles)
    ├── monaco-editor-*.js (editor)
    ├── monaco-editor-*.css (editor styles)
    ├── jszip.min-*.js (ZIP support)
    └── codicon-*.ttf (icons)
```

Total size: ~278KB (gzipped: ~90KB)
