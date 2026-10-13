#!/bin/sh
# Copy only the public site files into dist/ and deploy them to Cloudflare Pages.
# Content/ (raw photos, transcripts, purchased source art) and scripts/ are never uploaded.
# presentation/ (sales deck, login-only via functions/_middleware.js) ships with its own two sprig PNGs and the
# git-ignored demo video in presentation/media/ when it exists locally.
# functions/ (login gate + auth API) is picked up from the repo root; bindings live in wrangler.toml.
# Run from the repo root: sh scripts/deploy.sh
set -e
rm -rf dist && mkdir dist
cp *.html _headers robots.txt dist/
cp -R assets modules presentation dist/
rm -f dist/presentation/.gitignore
rm -f dist/assets/illustrations/sprig-*.png
find dist -name .DS_Store -delete
npx --yes wrangler@4 pages deploy dist --project-name siorbaty-mozhna --branch main --commit-dirty=true
