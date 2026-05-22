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

remote_head_ref="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
remote_default_branch="${remote_head_ref#origin/}"
current_branch="$(git branch --show-current 2>/dev/null || true)"

if git show-ref --verify --quiet refs/heads/main; then
  stabilization_source_ref="main"
elif [[ -n "$remote_default_branch" ]]; then
  stabilization_source_ref="$remote_default_branch"
elif [[ -n "$current_branch" ]]; then
  stabilization_source_ref="$current_branch"
else
  stabilization_source_ref="HEAD"
fi

echo "Using branch: ${branch_name}"
echo "Phase A stabilization backup source ref: ${stabilization_source_ref}"

git checkout -B "infra/stabilization-backup" "${stabilization_source_ref}"
echo "Created or updated branch: infra/stabilization-backup (from ${stabilization_source_ref})"

git checkout -b "${branch_name}" "${stabilization_source_ref}"
