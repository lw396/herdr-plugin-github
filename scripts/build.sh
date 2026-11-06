#!/bin/sh
# src/github -> mods/github: self-contained ESM bundle; copy mod.json, SVGs and other assets.
# mods/github is output only: it is emptied first, so a file deleted from src/ goes too.
# --watch: no emptying (Herdr would see the mod vanish); assets once, then esbuild watch.
set -eu
cd "$(dirname "$0")/.."
assets() {
  (cd src/github && find . -type f ! -name '*.ts') | while IFS= read -r f; do
    mkdir -p "mods/github/$(dirname "$f")" && cp "src/github/$f" "mods/github/$f"
  done
}
if [ "${1-}" = --watch ]; then
  mkdir -p mods/github && assets
  exec bun scripts/bundle.mjs --watch
fi
rm -rf mods/github && mkdir -p mods/github && assets
bun scripts/bundle.mjs
