#!/usr/bin/env bash
set -euo pipefail

# Phase 1 CI baseline stabilizer.
# Default mode is dry-run. Use --apply to perform filesystem changes.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOWS_DIR="$ROOT_DIR/.github/workflows"
ARCHIVE_DIR="$WORKFLOWS_DIR/_DISABLED_ARCHIVE"
BASELINE_WORKFLOW="$WORKFLOWS_DIR/ci-main.yml"
PLACEHOLDER_FILE="$WORKFLOWS_DIR/.placeholder"

MODE="dry-run"
if [[ "${1:-}" == "--apply" ]]; then
  MODE="apply"
fi

KEEP_WORKFLOWS=(
  "ci-main.yml"
  ".placeholder"
)

is_keep_file() {
  local filename="$1"
  for keep in "${KEEP_WORKFLOWS[@]}"; do
    if [[ "$filename" == "$keep" ]]; then
      return 0
    fi
  done
  return 1
}

run_cmd() {
  if [[ "$MODE" == "apply" ]]; then
    "$@"
  else
    echo "[dry-run] $*"
  fi
}

echo "==> Running phase1-ci-baseline in $MODE mode"

if [[ ! -d "$WORKFLOWS_DIR" ]]; then
  echo "Error: workflows directory not found at $WORKFLOWS_DIR" >&2
  exit 1
fi

run_cmd mkdir -p "$ARCHIVE_DIR"

if [[ ! -f "$BASELINE_WORKFLOW" ]]; then
  echo "==> Writing minimal baseline workflow: $BASELINE_WORKFLOW"
  if [[ "$MODE" == "apply" ]]; then
    cat > "$BASELINE_WORKFLOW" <<'YAML'
name: CI (Minimal)

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout triggering revision
        run: |
          git init .
          git remote add origin ${{ github.server_url }}/${{ github.repository }}
          git fetch --no-tags --depth=1 origin ${{ github.sha }}
          git checkout --detach FETCH_HEAD

      - name: Setup Node
        run: |
          curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
          sudo apt-get install -y nodejs

      - name: Setup PNPM
        run: npm install -g pnpm

      - name: Install deps
        run: pnpm install --frozen-lockfile

      - name: Build all
        run: pnpm build
YAML
  else
    echo "[dry-run] create $BASELINE_WORKFLOW"
  fi
else
  echo "==> Baseline workflow already exists: $BASELINE_WORKFLOW"
fi

if [[ ! -f "$PLACEHOLDER_FILE" ]]; then
  run_cmd touch "$PLACEHOLDER_FILE"
fi

shopt -s nullglob
for file in "$WORKFLOWS_DIR"/*.yml "$WORKFLOWS_DIR"/*.yaml; do
  filename="$(basename "$file")"

  if is_keep_file "$filename"; then
    continue
  fi

  target="$ARCHIVE_DIR/$filename"
  if [[ "$MODE" == "apply" ]]; then
    mv "$file" "$target"
  else
    echo "[dry-run] mv $file $target"
  fi
done
shopt -u nullglob

echo "==> Done. Active workflows now intended to be:"
echo "  - ci-main.yml"
echo "  - .placeholder"
echo
echo "Tip: run with --apply to make changes."
