#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

unmerged_files="$(git diff --name-only --diff-filter=U)"
unmerged_without_lockfile="$(printf '%s\n' "$unmerged_files" | sed '/^$/d; /^pnpm-lock\.yaml$/d')"

if [[ -n "$unmerged_without_lockfile" ]]; then
  echo "Resolve and stage the non-lockfile conflicts first:" >&2
  printf '  %s\n' $unmerged_without_lockfile >&2
  exit 1
fi

if ! printf '%s\n' "$unmerged_files" | grep -qx 'pnpm-lock.yaml'; then
  echo "pnpm-lock.yaml is not currently an unmerged file; nothing to resolve."
  exit 0
fi

# A lockfile is generated from the already-merged workspace manifests. Rebuilding
# it is safer than choosing one side or trying to edit generated YAML by hand.
rm -f pnpm-lock.yaml
pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts

if grep -qE '^(<{7}|={7}|>{7})' pnpm-lock.yaml; then
  echo "Conflict markers remain in pnpm-lock.yaml after regeneration." >&2
  exit 1
fi

pnpm install --frozen-lockfile --lockfile-only --ignore-scripts
git add pnpm-lock.yaml

echo "Resolved and staged pnpm-lock.yaml from the merged package manifests."
echo "Review git status, run the relevant checks, and continue the merge or rebase."
