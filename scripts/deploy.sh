#!/bin/sh
# Copy only the public site files into dist/ and deploy them to Cloudflare Pages.
# Content/ (raw photos, transcripts, purchased source art) and scripts/ are never uploaded.
# Run from the repo root: sh scripts/deploy.sh
set -e
rm -rf dist && mkdir dist
cp *.html _headers robots.txt dist/
cp -R assets modules dist/
rm -f dist/assets/illustrations/sprig-*.png
find dist -name .DS_Store -delete
npx --yes wrangler@4 pages deploy dist --project-name siorbaty-mozhna --branch main --commit-dirty=true
