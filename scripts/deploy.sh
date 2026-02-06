#!/bin/bash
# Auto-deploy script for PostBoy
# This script builds and automatically deploys to Cloudflare Pages

set -e

echo "🔨 Building PostBoy..."
npm run build

echo "🚀 Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=postboy

echo "✅ Deployment complete!"
