#!/bin/sh
# Bundle test/smoke/main.ts with the mod's own esbuild options (scripts/bundle.mjs) and let Herdr load it:
# parser and reader code run in QuickJS.
set -eu
cd "$(dirname "$0")/.."
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
bun scripts/bundle.mjs test/smoke/main.ts "$out/main.js"
herdr-app check "$out"
