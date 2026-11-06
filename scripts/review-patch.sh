#!/bin/sh
# Write the change since <base> to a file reviewers read: their own diff tools may only see the working tree.
# Generated output (mods/github) and the lockfile are left out and listed in the header.
set -eu
cd "$(dirname "$0")/.."
base=${1:?usage: scripts/review-patch.sh <base> [out]}
out=${2:-$(mktemp -t review-XXXXXX.patch)}
git rev-parse --verify --quiet "$base^{commit}" >/dev/null || { echo "unknown base: $base" >&2; exit 1; }
{
  echo "# Review patch: $base...HEAD (excluded: mods/github/, bun.lock)"
  git log --oneline "$base..HEAD" | sed 's/^/# /'
  git diff "$base...HEAD" -- . ':(exclude)mods/github' ':(exclude)bun.lock'
} > "$out"
grep -q '^diff --git' "$out" || { echo "empty diff since $base" >&2; exit 1; }
echo "$out"
