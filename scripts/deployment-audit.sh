#!/usr/bin/env bash
set -uo pipefail

URLS=(
  "https://goldshore.ai"
  "https://www.goldshore.ai"
  "https://goldshore.org"
  "https://www.goldshore.org"
  "https://gearswipe.com"
  "https://www.gearswipe.com"
  "https://api.goldshore.ai/health"
  "https://gw.goldshore.ai/health"
  "https://radar.goldshore.ai"
  "https://goldshore.github.io"
  "https://goldshore.github.io/apps/risk-radar/"
)

for url in "${URLS[@]}"; do
  echo "=== $url ==="
  if curl -sS -L -I "$url" -o /tmp/goldshore.audit.headers.txt -w "status=%{http_code} final=%{url_effective} redirects=%{num_redirects} tls=%{ssl_verify_result}\n"; then
    cat /tmp/goldshore.audit.headers.txt
  else
    echo "probe_error=network_or_dns_failure"
  fi
  echo

done
