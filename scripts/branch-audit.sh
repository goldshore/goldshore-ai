#!/bin/bash
set -euo pipefail

REPORT_PATH="reports/branch-audit-log.txt"
mkdir -p "$(dirname "$REPORT_PATH")"

{
  echo "Branch Conflict Audit"
  echo "Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo

  git fetch --all --prune

  for branch in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin/)
  do
    echo "Checking $branch"
    git diff --name-status origin/main..."$branch" || true
    echo
  done
} | tee "$REPORT_PATH"
