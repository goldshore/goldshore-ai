#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <type> <slug>"
  echo "Types: feat | fix | chore | docs | refactor"
  exit 1
fi

type="$1"
slug="$2"

case "$type" in
  feat|fix|chore|docs|refactor) ;;
  *)
    echo "Unsupported branch type: $type"
    exit 1
    ;;
esac

normalized_slug="$(echo "$slug" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
branch_name="${type}/${normalized_slug}"

echo "Using branch: ${branch_name}"

git checkout -b "${branch_name}"
