#!/bin/sh
# Bundle test/smoke/main.ts like the mod and let Herdr load it: parser and reader code run in QuickJS.
set -eu
cd "$(dirname "$0")/.."
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
bunx esbuild test/smoke/main.ts --bundle --format=esm --platform=neutral --target=es2022 \
  --external:herdr --external:gpui-kit --external:gpui-base --log-level=warning --outfile="$out/main.js"
herdr-app check "$out"
