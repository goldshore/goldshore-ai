#!/bin/bash

# Branch Lifecycle Tagger
# Usage: ./scripts/tag-branches.sh
# Tags all existing branches with lifecycle status

set -e

REPO_URL="https://github.com/marzton/goldshore-ai"

echo "🏷️  Goldshore Branch Lifecycle Tagger"
echo "======================================"
echo ""

# Get all branches
BRANCHES=$(git for-each-ref refs/remotes/origin --format='%(refname:short)' | sed 's|origin/||')

# Create temp file for tracking
TAGS_FILE=$(mktemp)
trap "rm -f $TAGS_FILE" EXIT

echo "Scanning branches..."
echo ""

for branch in $BRANCHES; do
  # Skip special branches (these will be auto-protected)
  if [[ "$branch" =~ ^(main|stage|develop|production)$ ]]; then
    echo "[protected] $branch"
    echo "$branch [status:protected]" >> "$TAGS_FILE"
    continue
  fi

  # Get last commit timestamp
  LAST_COMMIT=$(git log --max-count=1 --format=%aI origin/$branch 2>/dev/null)
  DAYS_OLD=$(( ($(date +%s) - $(date -d "$LAST_COMMIT" +%s)) / 86400 ))

  # Check if has open PR
  HAS_PR=$(gh pr list --head "$branch" --state open 2>/dev/null | wc -l)

  # Assign status
  if [ "$DAYS_OLD" -lt 7 ] && [ "$HAS_PR" -gt 0 ]; then
    STATUS="[status:active]"
    SYMBOL="🟢"
  elif [ "$DAYS_OLD" -lt 30 ] && [ "$HAS_PR" -eq 0 ]; then
    STATUS="[status:frozen]"
    SYMBOL="🟡"
    echo "  Reason: No open PR, likely paused"
  elif [ "$DAYS_OLD" -ge 30 ] && [ "$HAS_PR" -eq 0 ]; then
    STATUS="[status:stale]"
    SYMBOL="🔴"
    echo "  Action: Will auto-delete after 45 days"
  else
    STATUS="[status:archived]"
    SYMBOL="🔵"
  fi

  echo "$SYMBOL $branch (${DAYS_OLD}d) — $STATUS"
  echo "$branch $STATUS" >> "$TAGS_FILE"
done

echo ""
echo "To apply these tags to GitHub branch descriptions:"
echo ""
echo "1. Go to: $REPO_URL/branches"
echo "2. For each branch, click ⚙️ → Edit branch description"
echo "3. Add the status tag from above"
echo ""
echo "Example:"
echo "  [status:active] Lead: Claude | Phase: 4 | ETA: 2026-08-16"
echo ""
echo "Auto-tagging will start with next CI run (daily at 2 AM UTC)."
