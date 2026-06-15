#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-/home/user/goldshore-ai}"

echo "Installing pnpm dependencies..."
pnpm install --frozen-lockfile=false
echo "Dependencies installed."
