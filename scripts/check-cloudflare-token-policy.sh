#!/usr/bin/env bash
set -euo pipefail

workflows_dir=".github/workflows"

echo "Checking for disallowed fallback secret expressions in workflow env blocks..."
if rg -n 'CLOUDFLARE_(BUILD_)?API_TOKEN:\s*\$\{\{[^}]*\|\|[^}]*\}\}' "$workflows_dir"; then
  echo "Disallowed token fallback expression found in workflow env block."
  echo "Migration: replace fallback expressions with secrets.CLOUDFLARE_BUILD_API_TOKEN only."
  exit 1
fi

echo "Checking canonical deploy token wiring..."
if ! rg -n 'RAW_CLOUDFLARE_API_TOKEN:\s*\$\{\{\s*secrets\.CLOUDFLARE_BUILD_API_TOKEN\s*\}\}' "$workflows_dir/deploy-gs-api.yml" >/dev/null; then
  echo "deploy-gs-api.yml must normalize secrets.CLOUDFLARE_BUILD_API_TOKEN before use"
  exit 1
fi
if ! rg -n 'RAW_CLOUDFLARE_API_TOKEN:\s*\$\{\{\s*secrets\.CLOUDFLARE_BUILD_API_TOKEN\s*\}\}' "$workflows_dir/deploy-gs-web.yml" >/dev/null; then
  echo "deploy-gs-web.yml must normalize secrets.CLOUDFLARE_BUILD_API_TOKEN before use"
  exit 1
fi

if compgen -G "$workflows_dir/deploy-*.yml" >/dev/null; then
  unexpected=$(find "$workflows_dir" -maxdepth 1 -name 'deploy-*.yml' \
    ! -name 'deploy-gs-api.yml' \
    ! -name 'deploy-gs-web.yml' \
    -print)
  if [ -n "$unexpected" ]; then
    echo "Unexpected deploy workflow(s):"
    echo "$unexpected"
    exit 1
  fi
fi

echo "Cloudflare token policy checks passed."
