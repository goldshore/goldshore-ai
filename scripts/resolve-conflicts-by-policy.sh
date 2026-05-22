#!/usr/bin/env bash
set -euo pipefail

RB="${1:?remote branch required}"
REPORT_DIR="${2:-reports/branch-merge}"
mkdir -p "$REPORT_DIR"

UFILES="$(git diff --name-only --diff-filter=U || true)"
if [ -z "$UFILES" ]; then
  exit 0
fi

echo "Policy-resolving conflicts for: $RB" >> "$REPORT_DIR/policy.log"
echo "$UFILES" >> "$REPORT_DIR/policy.log"

for f in $UFILES; do
  case "$f" in
    pnpm-lock.yaml|package-lock.json|yarn.lock)
      git checkout --ours -- "$f"
      git add "$f"
      echo "LOCKFILE ours: $f" >> "$REPORT_DIR/policy.log"
      ;;
    */dist/*|*/.astro/*|*/.next/*|*/build/*|*/.cache/*)
      git checkout --ours -- "$f"
      git add "$f"
      echo "GENERATED ours: $f" >> "$REPORT_DIR/policy.log"
      ;;
    docs/*|*.md|.jules/*|journal/*|reports/*)
      git checkout --theirs -- "$f"
      git add "$f"
      echo "DOCS theirs: $f" >> "$REPORT_DIR/policy.log"
      ;;
    *)
      echo "SKIP unsafe: $f" >> "$REPORT_DIR/policy.log"
      ;;
  esac
done
