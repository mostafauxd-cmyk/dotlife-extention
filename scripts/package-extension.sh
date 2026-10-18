#!/usr/bin/env bash
# Builds the extension and zips apps/newtab/dist for the Chrome Web Store.
# The zip is named after the manifest version and written to release/.
# The store refuses a manifest with a `key` («key field is not allowed in manifest»), so the zip
# gets a copy of dist/ without it; dist/ itself keeps the key (a fixed id for unpacked loading).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

pnpm build

version="$(node -p "require('./apps/newtab/dist/manifest.json').version")"
mkdir -p release
out="release/noghte-newtab-${version}.zip"
stage="release/.stage"
rm -rf "$stage" "$out"
mkdir -p "$stage"
cp -R apps/newtab/dist/. "$stage/"
node -e '
const fs = require("node:fs");
const f = process.argv[1];
const m = JSON.parse(fs.readFileSync(f, "utf8"));
delete m.key;
fs.writeFileSync(f, JSON.stringify(m, null, 2) + "\n");
' "$stage/manifest.json"
(cd "$stage" && zip -qr -X "$root/$out" . -x '.DS_Store')
rm -rf "$stage"

echo "$out"
