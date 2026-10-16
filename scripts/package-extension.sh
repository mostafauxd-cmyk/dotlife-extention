#!/usr/bin/env bash
# Builds the extension and zips apps/newtab/dist for the Chrome Web Store.
# The zip is named after the manifest version and written to release/.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

pnpm build

version="$(node -p "require('./apps/newtab/dist/manifest.json').version")"
mkdir -p release
out="release/noghte-newtab-${version}.zip"
rm -f "$out"
(cd apps/newtab/dist && zip -qr -X "$root/$out" . -x '.DS_Store')

echo "$out"
