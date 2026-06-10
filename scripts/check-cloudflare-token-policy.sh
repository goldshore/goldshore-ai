#!/usr/bin/env bash
set -euo pipefail

workflows_dir=".github/workflows"

echo "Checking for disallowed fallback secret expressions in workflow env blocks..."
if rg -n 'CLOUDFLARE_(BUILD_)?API_TOKEN:\s*\$\{\{[^}]*\|\|[^}]*\}\}' "$workflows_dir"; then
  echo "❌ Disallowed token fallback expression found in workflow env block."
  echo "Migration: replace fallback expressions with secrets.CLOUDFLARE_BUILD_API_TOKEN only."
  exit 1
fi

echo "Checking canonical deploy token wiring..."
if ! rg -n 'CLOUDFLARE_API_TOKEN:\s*\$\{\{\s*secrets\.CF_WORKERS_BUILDS\s*\}\}' "$workflows_dir/deploy-platform.yml" >/dev/null; then
  echo "❌ deploy-platform.yml must set CLOUDFLARE_API_TOKEN from secrets.CF_WORKERS_BUILDS"
  exit 1
fi

echo "✅ Cloudflare token policy checks passed."
