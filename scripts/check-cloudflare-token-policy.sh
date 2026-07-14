#!/usr/bin/env bash
set -euo pipefail

workflows_dir=".github/workflows"

echo "Checking for disallowed fallback secret expressions in workflow env blocks..."
if rg -n 'CLOUDFLARE_(BUILD_)?API_TOKEN:\s*\$\{\{[^}]*\|\|[^}]*\}\}' "$workflows_dir"; then
  echo "❌ Disallowed token fallback expression found in workflow env block."
  echo "Migration: replace fallback expressions with secrets.CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN only."
  exit 1
fi

echo "Checking for deprecated Cloudflare deploy token secret names..."
if rg -n 'secrets\.(CLOUDFLARE_API_TOKEN_GS_CONTROL|CLOUDFLARE_BUILD_API_TOKEN|CF_WORKERS_BUILDS)\b' "$workflows_dir"; then
  echo "❌ Deprecated Cloudflare deploy token secret reference found."
  echo "Migration: use secrets.CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN and keep any temporary value alias in infra/secrets/secret-sync.manifest.yaml."
  exit 1
fi

echo "Checking canonical deploy token wiring..."
for workflow in deploy-platform.yml deploy-gs-api.yml deploy-gs-web.yml; do
  if ! rg -n 'CLOUDFLARE_API_TOKEN:\s*\$\{\{\s*secrets\.CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN\s*\}\}' "$workflows_dir/$workflow" >/dev/null; then
    echo "❌ $workflow must set CLOUDFLARE_API_TOKEN from secrets.CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN"
    exit 1
  fi
done

echo "✅ Cloudflare token policy checks passed."
