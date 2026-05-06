#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="main"
FETCH=1
MAX_BRANCHES=0
INCLUDE_MERGED=0

usage() {
  cat <<'USAGE'
Usage: scripts/merge-audit.sh [options]

Scans branches and reports whether they can be merged cleanly into a target branch.
Prefers remote branches from origin; if no remote exists, falls back to local branches.

Options:
  --target <ref>        Target branch/ref (default: main)
  --max <n>             Limit number of branches to scan (0 = no limit)
  --include-merged      Include branches already merged into target
  --no-fetch            Skip 'git fetch --all --prune'
  -h, --help            Show this help text

Examples:
  scripts/merge-audit.sh
  scripts/merge-audit.sh --target origin/main --max 25
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET_BRANCH="$2"
      shift 2
      ;;
    --max)
      MAX_BRANCHES="$2"
      shift 2
      ;;
    --include-merged)
      INCLUDE_MERGED=1
      shift
      ;;
    --no-fetch)
      FETCH=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

HAS_ORIGIN=0
if git remote | grep -qx 'origin'; then
  HAS_ORIGIN=1
fi

if [[ "$FETCH" -eq 1 && "$HAS_ORIGIN" -eq 1 ]]; then
  git fetch --all --prune >/dev/null
fi

if ! git rev-parse --verify "$TARGET_BRANCH" >/dev/null 2>&1; then
  if [[ "$TARGET_BRANCH" == origin/* ]]; then
    local_target="${TARGET_BRANCH#origin/}"
    if git rev-parse --verify "$local_target" >/dev/null 2>&1; then
      TARGET_BRANCH="$local_target"
    fi
  fi
fi

if ! git rev-parse --verify "$TARGET_BRANCH" >/dev/null 2>&1; then
  echo "Target branch '$TARGET_BRANCH' does not exist." >&2
  exit 1
fi

if [[ "$HAS_ORIGIN" -eq 1 ]]; then
  mapfile -t CANDIDATES < <(
    git for-each-ref --format='%(refname:short)' refs/remotes/origin \
      | awk -v target="$TARGET_BRANCH" '
        $0 != "origin/HEAD" && $0 != target && $0 != "origin/" target { print }
      ' \
      | sort
  )
else
  mapfile -t CANDIDATES < <(
    git for-each-ref --format='%(refname:short)' refs/heads \
      | awk -v target="$TARGET_BRANCH" '$0 != target { print }' \
      | sort
  )
fi

if [[ "${#CANDIDATES[@]}" -eq 0 ]]; then
  echo "No branches found to evaluate."
  exit 0
fi

TMP_DIR=$(mktemp -d)
cleanup() {
  git worktree remove --force "$TMP_DIR" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

git worktree add --detach "$TMP_DIR" "$TARGET_BRANCH" >/dev/null

printf "Target: %s\n" "$TARGET_BRANCH"
printf "%-45s %-10s %-10s\n" "BRANCH" "STATUS" "MERGED"
printf "%-45s %-10s %-10s\n" "---------------------------------------------" "----------" "----------"

count=0
clean=0
conflicts=0
skipped=0

for branch in "${CANDIDATES[@]}"; do
  if [[ "$MAX_BRANCHES" -gt 0 && "$count" -ge "$MAX_BRANCHES" ]]; then
    break
  fi

  merged="no"
  if git merge-base --is-ancestor "$branch" "$TARGET_BRANCH"; then
    merged="yes"
    if [[ "$INCLUDE_MERGED" -eq 0 ]]; then
      skipped=$((skipped + 1))
      continue
    fi
  fi

  count=$((count + 1))

  if git -C "$TMP_DIR" merge --no-commit --no-ff "$branch" >/dev/null 2>&1; then
    status="clean"
    clean=$((clean + 1))
    git -C "$TMP_DIR" merge --abort >/dev/null 2>&1 || git -C "$TMP_DIR" reset --hard >/dev/null 2>&1
  else
    status="conflict"
    conflicts=$((conflicts + 1))
    git -C "$TMP_DIR" merge --abort >/dev/null 2>&1 || git -C "$TMP_DIR" reset --hard >/dev/null 2>&1
  fi

  printf "%-45s %-10s %-10s\n" "$branch" "$status" "$merged"
done

printf "\nScanned: %d | Clean: %d | Conflicts: %d | Skipped merged: %d\n" "$count" "$clean" "$conflicts" "$skipped"
