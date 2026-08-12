#!/usr/bin/env bash
set -euo pipefail

workflows_dir=".github/workflows"

echo "Checking for disallowed fallback secret expressions in workflow env blocks..."
if rg -n 'CLOUDFLARE_(BUILD_)?API_TOKEN:\s*\$\{\{[^}]*\|\|[^}]*\}\}' "$workflows_dir"; then
  echo "Disallowed token fallback expression found in workflow env block."
  echo "Migration: replace fallback expressions with secrets.CLOUDFLARE_BUILD_API_TOKEN only."
  exit 1
fi

echo "Checking dashboard-owned deploy workflows are credential-free and read-only..."
if rg -n 'CLOUDFLARE_(?:API_TOKEN|API_KEY|BUILD_API_TOKEN)|\bCF_API\b|wrangler\s+(?:deploy|delete|secret|kv|d1|r2|queue|workflow)\b' \
  "$workflows_dir/deploy-gs-api.yml" "$workflows_dir/deploy-gs-web.yml"; then
  echo "Canonical deploy workflow files must not contain Cloudflare credentials or mutation commands."
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
