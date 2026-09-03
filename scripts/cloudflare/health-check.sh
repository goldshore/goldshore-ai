#!/usr/bin/env bash
set -euo pipefail

url="${1:?health URL is required}"
for attempt in 1 2 3 4 5; do
  echo "Health check $attempt/5: $url"
  if curl --fail --silent --show-error --max-time 20 "$url" >/dev/null; then
    exit 0
  fi
  sleep 10
done
echo "Health check failed: $url" >&2
exit 1
