# Deploy Now - No Domain Needed

## ✅ Ready to Deploy

You don't need to own a domain! Cloudflare Pages gives you a free subdomain.

## Quick Deploy (2 minutes)

### Option 1: Cloudflare Dashboard (Easiest)

1. **Go to Cloudflare Pages**
   - Visit: https://pages.cloudflare.com
   - Sign in (or create free account)

2. **Create Project**
   - Click "Create a project"
   - Choose "Upload assets"

3. **Upload Build**
   - Project name: `postboy`
   - Drag and drop the `dist/` folder
   - Click "Deploy site"

4. **Done!**
   - Your site is live at: `https://postboy.pages.dev`
   - Takes ~30 seconds

### Option 2: Wrangler CLI

```bash
# Install Wrangler (one time)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy dist --project-name=postboy
```

Your site will be at: `https://postboy.pages.dev`

## What You Get

- ✅ Free HTTPS URL: `https://postboy.pages.dev`
- ✅ HTTPS enabled automatically
- ✅ Global CDN
- ✅ No domain purchase needed
- ✅ Works immediately

## Add Custom Domain Later

If you want `dev-postboy.dev` later:
1. Purchase `postboy.dev` from a registrar (e.g., Cloudflare Registrar, Namecheap, etc.)
2. Follow `CUSTOM_DOMAIN_SETUP.md` to configure it

## That's It!

Your PostBoy app will be live and ready to use at the free Cloudflare Pages URL.
