#!/bin/sh
# Refresh types/ and docs/herdr/AGENTS.md from an installed Herdr app.
# Herdr rewrites these in its home on every start, matching that version.
set -eu
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
root=$(cd "$(dirname "$0")/.." && pwd)
for f in herdr.d.ts gpui-kit.d.ts AGENTS.md; do
  [ -f "$home/$f" ] || { echo "missing $home/$f: start Herdr once (or set HERDR_APP_HOME)" >&2; exit 1; }
done
cp "$home/herdr.d.ts" "$home/gpui-kit.d.ts" "$root/types/"
cp "$home/AGENTS.md" "$root/docs/herdr/AGENTS.md"
version=$(herdr-app --version 2>/dev/null || echo unknown)
echo "$version" > "$root/types/VERSION"
echo "types updated from $home ($version)"
