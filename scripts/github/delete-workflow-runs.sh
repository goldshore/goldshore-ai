#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GH_REPO:?GH_REPO is required}"

STATUS_FILTER="${STATUS_FILTER:-startup_failure,failure,cancelled}"
WORKFLOW_FILTER="${WORKFLOW_FILTER:-}"
MAX_RUNS="${MAX_RUNS:-500}"
DRY_RUN="${DRY_RUN:-false}"

IFS=',' read -r -a statuses <<< "$STATUS_FILTER"

echo "Repository: $GH_REPO"
echo "Statuses: $STATUS_FILTER"
echo "Workflow filter: ${WORKFLOW_FILTER:-<none>}"
echo "Max runs: $MAX_RUNS"
echo "Dry run: $DRY_RUN"

deleted=0
considered=0

for status in "${statuses[@]}"; do
  status_trimmed="$(echo "$status" | xargs)"
  [ -n "$status_trimmed" ] || continue

  runs_json="$(gh run list --repo "$GH_REPO" --status "$status_trimmed" --limit "$MAX_RUNS" --json databaseId,workflowName,displayTitle,createdAt || true)"

  run_ids="$(echo "$runs_json" | jq -r --arg wf "$WORKFLOW_FILTER" '
    .[]
    | select(($wf == "") or (.workflowName == $wf))
    | .databaseId
  ' || true)"

  [ -n "$run_ids" ] || continue

  while IFS= read -r run_id; do
    [ -n "$run_id" ] || continue
    considered=$((considered + 1))

    if [ "$DRY_RUN" = "true" ]; then
      echo "[dry-run] would delete run id: $run_id"
      continue
    fi

    echo "Deleting run id: $run_id"
    if gh run delete "$run_id" --repo "$GH_REPO"; then
      deleted=$((deleted + 1))
    fi
  done <<< "$run_ids"
done

echo "Considered runs: $considered"
echo "Deleted runs: $deleted"
