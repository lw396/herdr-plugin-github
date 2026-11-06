#!/bin/sh
# src/github -> mods/github: tsc for *.ts, a copy for everything else (mod.json, *.svg, ...).
# mods/github is output only: it is emptied first, so a file deleted from src/ goes too.
# --watch: no emptying (Herdr would see the mod vanish); assets once, then tsc --watch.
set -eu
cd "$(dirname "$0")/.."
assets() {
  (cd src/github && find . -type f ! -name '*.ts') | while IFS= read -r f; do
    mkdir -p "mods/github/$(dirname "$f")" && cp "src/github/$f" "mods/github/$f"
  done
}
if [ "${1-}" = --watch ]; then
  mkdir -p mods/github && assets
  exec tsc -p tsconfig.json --watch --preserveWatchOutput
fi
rm -rf mods/github && mkdir -p mods/github && assets
tsc -p tsconfig.json
