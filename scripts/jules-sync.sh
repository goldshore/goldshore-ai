#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${1:-https://gs-admin.pages.dev/}"
CLIENT_ID="${CF_ACCESS_CLIENT_ID:-}"
CLIENT_SECRET="${CF_ACCESS_CLIENT_SECRET:-}"
TRUSTED_HOSTS=("gs-admin.pages.dev" "admin.goldshore.ai" "ops.goldshore.ai")

if [[ -z "$CLIENT_ID" || -z "$CLIENT_SECRET" ]]; then
  echo "Missing CF_ACCESS_CLIENT_ID or CF_ACCESS_CLIENT_SECRET" >&2
  exit 1
fi

host=$(python - "$TARGET_URL" <<'PY'
import sys
from urllib.parse import urlparse
print(urlparse(sys.argv[1]).hostname or "")
PY
)

if [[ ! " ${TRUSTED_HOSTS[*]} " =~ " ${host:-} " ]]; then
  echo "Refusing to send service-token headers to untrusted host: ${host:-<none>}" >&2
  exit 1
fi

echo "Testing Cloudflare Access service-token auth against: $TARGET_URL"

curl -sS -o /tmp/jules-sync-response.txt -D /tmp/jules-sync-headers.txt \
  -H "CF-Access-Client-Id: $CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CLIENT_SECRET" \
  "$TARGET_URL"

status=$(awk 'toupper($1) ~ /^HTTP\// {code=$2} END {print code}' /tmp/jules-sync-headers.txt)

echo "HTTP status: ${status:-unknown}"
if [[ "${status:-}" =~ ^2[0-9][0-9]$ ]]; then
  echo "Service token auth passed."
else
  echo "Service token auth failed. Response headers:" >&2
  cat /tmp/jules-sync-headers.txt >&2
  exit 1
fi
