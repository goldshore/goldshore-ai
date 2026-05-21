#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-origin/main}"
STAGING="${2:-merge/all-branches}"
REPORT_DIR="reports/branch-merge"
mkdir -p "$REPORT_DIR"

git fetch --all --prune

# Create/reset staging branch
git checkout -B "$STAGING" "$BASE"

# List remote branches (exclude main + HEAD and the remote root ref)
mapfile -t BRANCHES < <(
  git for-each-ref --format='%(refname:short)' refs/remotes/origin \
  | grep '^origin/' \
  | grep -vE '^origin/(main|HEAD)$'
)

echo "Merging into $STAGING from $BASE" | tee "$REPORT_DIR/summary.txt"
echo "" >> "$REPORT_DIR/summary.txt"

for rb in "${BRANCHES[@]}"; do
  echo "==> Merge $rb" | tee -a "$REPORT_DIR/summary.txt"

  if git merge --no-ff --no-edit "$rb"; then
    echo "OK: $rb" | tee -a "$REPORT_DIR/summary.txt"
    continue
  fi

  echo "CONFLICT: $rb" | tee -a "$REPORT_DIR/summary.txt"

  ./scripts/resolve-conflicts-by-policy.sh "$rb" "$REPORT_DIR" || true

  if git diff --name-only --diff-filter=U | grep -q .; then
    echo "UNRESOLVED after policy: $rb" | tee -a "$REPORT_DIR/summary.txt"
    {
      echo "--- $rb ---"
      git diff --name-only --diff-filter=U
      git diff --unified=0 --diff-filter=U || true
    } >> "$REPORT_DIR/conflicts.txt"
    git merge --abort
  elif git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1; then
    git commit -m "Merge $rb (policy-resolved conflicts)"
    echo "RESOLVED by policy: $rb" | tee -a "$REPORT_DIR/summary.txt"
  else
    echo "SKIPPED: $rb (merge could not start cleanly)" | tee -a "$REPORT_DIR/summary.txt"
  fi
done

echo "Done. See $REPORT_DIR" | tee -a "$REPORT_DIR/summary.txt"
