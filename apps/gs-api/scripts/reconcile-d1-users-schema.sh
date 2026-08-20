#!/usr/bin/env bash

set -euo pipefail

database_name="${1:-gs_platform_db}"
environment_name="${2:-prod}"

query_json() {
  pnpm exec wrangler d1 execute "$database_name" \
    --remote \
    --env "$environment_name" \
    --yes \
    --json \
    --command "$1"
}

result_count() {
  node -e "const payload=JSON.parse(require('fs').readFileSync(0,'utf8')); const results=payload?.[0]?.results; if(!Array.isArray(results)) process.exit(1); console.log(results.length)"
}

table_count="$(query_json "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'" | result_count)"

if [[ "$table_count" == "0" ]]; then
  echo "users table is absent; the canonical identity migration will create it"
  exit 0
fi

ensure_column() {
  local column_name="$1"
  local column_definition="$2"
  local count

  count="$(query_json "SELECT name FROM pragma_table_info('users') WHERE name = '$column_name'" | result_count)"

  if [[ "$count" != "0" ]]; then
    echo "users.$column_name already exists"
    return
  fi

  echo "Adding users.$column_name for the canonical identity schema"
  pnpm exec wrangler d1 execute "$database_name" \
    --remote \
    --env "$environment_name" \
    --yes \
    --command "ALTER TABLE users ADD COLUMN $column_definition"
}

# The legacy platform schema predates the identity/RBAC schema. CREATE TABLE IF
# NOT EXISTS cannot add these columns, while the owner-role migration requires
# all three. Check each column first so repeated production deploys stay safe.
ensure_column "display_name" "display_name TEXT"
ensure_column "disabled_at" "disabled_at TEXT"
ensure_column "deleted_at" "deleted_at TEXT"
