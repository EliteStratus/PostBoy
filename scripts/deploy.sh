#!/bin/bash
# Build and deploy PostBoy to Cloudflare Pages.
# Same as: npm run build
set -e
echo "Building and deploying PostBoy..."
npm run build
echo "Done."
