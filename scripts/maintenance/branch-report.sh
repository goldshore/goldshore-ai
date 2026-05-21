#!/usr/bin/env bash
set -euo pipefail

REPORT_PATH="reports/maintenance/branch-report.txt"
mkdir -p "$(dirname "$REPORT_PATH")"

LOG_REF="${LOG_REF:-origin/main}"
LOG_LIMIT="${LOG_LIMIT:-20}"

if ! [[ "$LOG_LIMIT" =~ ^[0-9]+$ ]]; then
  echo "LOG_LIMIT must be numeric, got: $LOG_LIMIT" >&2
  exit 1
fi

git fetch origin --prune

if ! git rev-parse --verify "$LOG_REF" >/dev/null 2>&1; then
  echo "LOG_REF does not exist: $LOG_REF" >&2
  exit 1
fi

{
  echo "# Maintenance branch report"
  echo
  echo "Mode: inspection-only"
  echo "Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "Repository: ${GITHUB_REPOSITORY:-local}"
  echo "Workflow ref: ${GITHUB_REF:-local}"
  echo "Protected branch mutation guard: direct rewrites are not permitted from CI."
  echo
  echo "## Remote branches"
  git branch -r --sort=-committerdate
  echo
  echo "## Open pull requests"
  if command -v gh >/dev/null 2>&1; then
    gh pr list \
      --state open \
      --limit 50 \
      --json number,title,headRefName,baseRefName,updatedAt,url \
      --jq '.[] | "#\(.number) \(.headRefName) -> \(.baseRefName) | \(.updatedAt) | \(.title) | \(.url)"'
  else
    echo "gh CLI is not available on this runner - open pull request information will be omitted from this report."
  fi
  echo
  echo "## Recent commits for ${LOG_REF}"
  git log --decorate --oneline -n "$LOG_LIMIT" "$LOG_REF"
} | tee "$REPORT_PATH"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Maintenance branch report"
    echo
    echo "- Mode: inspection-only"
    echo "- Report artifact: \`maintenance-branch-report\`"
    echo "- Remote branches collected with \`git branch -r\`"
    echo "- Open pull requests collected with \`gh pr list\`"
    echo "- Recent commits collected with \`git log\`"
    echo "- Protected branch guard: no branch checkout, pull, rebase, merge, or push occurs in CI"
  } >> "$GITHUB_STEP_SUMMARY"
fi
