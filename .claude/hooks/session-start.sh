#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-/home/user/goldshore-ai}"

echo "Installing pnpm dependencies..."
pnpm install --frozen-lockfile=false
echo "Dependencies installed."

# ── Load secrets from Cloudflare KV ─────────────────────────────────────────
# Tries GS_CONFIG namespace first, falls back to GOLDSHORE-AI namespace.
# Requires CLOUDFLARE_API_TOKEN in the session environment.
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  CF_ACCOUNT="f77de112d2019e5456a3198a8bb50bd2"
  GS_CONFIG_NS="68f52b467dc0413991b2195ef9081cae"
  GOLDSHORE_AI_NS="5f13370575784c9dacff522121104cb3"
  GS_AGENT_NS="25a1eeba1de14e06af18c45b1b2c9743"

  fetch_kv() {
    local ns="$1" key="$2"
    curl -sf \
      "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${ns}/values/${key}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" 2>/dev/null || true
  }

  load_secret() {
    local key="$1"
    local value
    value=$(fetch_kv "$GS_CONFIG_NS" "$key")
    [ -z "$value" ] && value=$(fetch_kv "$GOLDSHORE_AI_NS" "$key")
    [ -z "$value" ] && value=$(fetch_kv "$GS_AGENT_NS" "$key")
    if [ -n "$value" ]; then
      export "${key}=${value}"
      echo "✅ Loaded ${key} from CF KV"
    else
      echo "⚠️  ${key} not found in CF KV (set manually if needed)"
    fi
  }

  echo "Loading secrets from Cloudflare KV..."
  load_secret OPENAI_API_KEY
  load_secret ACLED_API_KEY
  load_secret MARKET_DATA_API_KEY
  load_secret RESEND_API_KEY
  load_secret FORMSPREE_ENDPOINT
  echo "Secret loading complete."
else
  echo "⚠️  CLOUDFLARE_API_TOKEN not set — skipping CF KV secret loading"
fi
