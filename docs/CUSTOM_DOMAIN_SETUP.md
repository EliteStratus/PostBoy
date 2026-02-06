# Custom Domain Setup: dev-postboy.dev

## Overview

To use a custom domain like `https://dev-postboy.dev`, you need to:
1. Own the domain (e.g., `postboy.dev`)
2. Deploy to Cloudflare Pages
3. Configure the custom domain in Cloudflare

## Step 1: Domain Requirements

You need to own the domain `postboy.dev` (or similar). Options:
- Purchase `postboy.dev` from a domain registrar
- Use an existing domain you own
- Use Cloudflare Registrar (recommended for easiest setup)

## Step 2: Deploy to Cloudflare Pages

### First Deployment

1. Go to https://pages.cloudflare.com
2. Create project → Upload assets
3. Project name: `postboy`
4. Drag & drop `dist/` folder
5. Deploy

Your site will initially be at: `https://postboy.pages.dev`

### Or via Wrangler CLI

```bash
wrangler pages deploy dist --project-name=postboy
```

## Step 3: Add Custom Domain

### If Domain is in Cloudflare

1. Go to your Cloudflare Pages project
2. Click "Custom domains" tab
3. Click "Set up a custom domain"
4. Enter: `dev-postboy.dev`
5. Cloudflare will automatically configure DNS

### If Domain is External

1. Go to your Cloudflare Pages project
2. Click "Custom domains" tab
3. Click "Set up a custom domain"
4. Enter: `dev-postboy.dev`
5. Add the CNAME record in your domain's DNS:
   - Type: `CNAME`
   - Name: `dev-postboy`
   - Target: `postboy.pages.dev`
   - TTL: Auto

## Step 4: SSL Certificate

Cloudflare automatically provisions SSL certificates for custom domains. This usually takes a few minutes.

## Alternative: Subdomain Setup

If you want multiple environments:

- **Dev**: `dev-postboy.dev` → `postboy` project (dev branch)
- **Production**: `postboy.dev` → `postboy` project (main branch)

Or create separate projects:
- **Dev**: `dev-postboy.dev` → `postboy-dev` project
- **Production**: `postboy.dev` → `postboy` project

## Quick Setup Commands

```bash
# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=postboy

# Then add custom domain via Cloudflare Dashboard
# Custom domains → Add domain → dev-postboy.dev
```

## DNS Configuration

### Cloudflare DNS (Recommended)
- Automatically configured when domain is in Cloudflare
- SSL certificate auto-provisioned

### External DNS
Add CNAME record:
```
Type: CNAME
Name: dev-postboy
Target: postboy.pages.dev
```

## Verification

After setup:
1. Wait for DNS propagation (usually instant with Cloudflare)
2. Wait for SSL certificate (1-5 minutes)
3. Visit `https://dev-postboy.dev`
4. Should see your PostBoy application

## Troubleshooting

### Domain Not Resolving
- Check DNS records are correct
- Wait for DNS propagation (up to 24 hours for external DNS)
- Verify CNAME target is correct

### SSL Certificate Issues
- Cloudflare auto-provisions SSL
- May take a few minutes
- Check SSL/TLS settings in Cloudflare

### Multiple Environments

For dev and production on same domain:
- Use branch-based deployments
- Set production branch to `main` for `postboy.dev`
- Set preview deployments for `dev` branch → `dev-postboy.dev`

Or use separate projects:
- `postboy-dev` project → `dev-postboy.dev`
- `postboy` project → `postboy.dev`
