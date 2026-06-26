#!/usr/bin/env bash
# GoldShore Cloudflare Cleanup Script
# Usage: CLOUDFLARE_API_TOKEN=your_token bash scripts/cf-cleanup.sh
#
# What this does:
#   1. Lists all Pages projects and their custom domains
#   2. Deletes orphaned DNS CNAME records blocking admin.goldshore.ai
#   3. Deletes orphaned/stub workers (goldshore-ai, gs-web-staging, gs-todo)
#   4. Purges all deployments from legacy Pages projects then deletes them
#   5. Prints a final clean state summary

set -euo pipefail

CF_TOKEN="${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"
ACCOUNT_ID="f77de112d2019e5456a3198a8bb50bd2"
ZONE_GOLDSHORE_AI=""  # filled in step 0

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; }

cf() {
  local method="$1"; shift
  local path="$1"; shift
  curl -s -X "$method" "https://api.cloudflare.com/client/v4$path" \
    -H "Authorization: Bearer $CF_TOKEN" \
    -H "Content-Type: application/json" \
    "$@"
}

echo "=== Step 0: Get zone IDs ==="

ZONE_GOLDSHORE_AI=$(cf GET "/zones?name=goldshore.ai" | python3 -c "import json,sys; print(json.load(sys.stdin)['result'][0]['id'])")
ok "goldshore.ai zone: $ZONE_GOLDSHORE_AI"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== Step 1: List all Pages projects ==="

PAGES=$(cf GET "/accounts/$ACCOUNT_ID/pages/projects?per_page=100")
echo "$PAGES" | python3 -c "
import json,sys
data = json.load(sys.stdin)
for p in data.get('result', []):
    domains = [d.get('domain','') for d in p.get('domains', [])]
    print(f\"  {p['name']:40s}  domains: {', '.join(domains) or '(none)'}\")
"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== Step 2: Fix admin.goldshore.ai DNS conflict ==="

# Find CNAME records for admin.goldshore.ai
ADMIN_RECORDS=$(cf GET "/zones/$ZONE_GOLDSHORE_AI/dns_records?type=CNAME&name=admin.goldshore.ai")
ADMIN_RECORD_IDS=$(echo "$ADMIN_RECORDS" | python3 -c "
import json,sys
data = json.load(sys.stdin)
for r in data.get('result', []):
    print(f\"{r['id']}  {r['name']} → {r['content']}\")
")

if [ -z "$ADMIN_RECORD_IDS" ]; then
  warn "No CNAME for admin.goldshore.ai found (may have already been deleted)"
else
  echo "  Found CNAME records:"
  echo "$ADMIN_RECORD_IDS"
  while IFS= read -r line; do
    RECORD_ID=$(echo "$line" | awk '{print $1}')
    RESULT=$(cf DELETE "/zones/$ZONE_GOLDSHORE_AI/dns_records/$RECORD_ID")
    if echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null; then
      ok "Deleted CNAME $RECORD_ID ($line)"
    else
      err "Failed to delete $RECORD_ID: $RESULT"
    fi
  done <<< "$ADMIN_RECORD_IDS"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== Step 3: Delete orphaned stub workers ==="

STUBS=("goldshore-ai" "gs-web-staging" "gs-todo")

for worker in "${STUBS[@]}"; do
  RESULT=$(cf DELETE "/accounts/$ACCOUNT_ID/workers/scripts/$worker")
  if echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null; then
    ok "Deleted worker: $worker"
  else
    MSG=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('errors', [{}])[0].get('message','unknown'))" 2>/dev/null)
    warn "Could not delete $worker: $MSG"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== Step 4: Delete orphaned/legacy Pages projects ==="

# Pages projects to delete: old versions that are superseded
# We'll auto-detect any project not in the keep list
KEEP_PAGES=("gs-web" "gs-admin" "gs-www-redirect")

ALL_PAGES=$(cf GET "/accounts/$ACCOUNT_ID/pages/projects?per_page=100" | python3 -c "
import json,sys
data = json.load(sys.stdin)
for p in data.get('result', []):
    print(p['name'])
")

while IFS= read -r project; do
  if [[ " ${KEEP_PAGES[*]} " == *" $project "* ]]; then
    ok "Keeping: $project"
    continue
  fi

  # Purge all deployments first (required before project delete if GitHub-connected)
  DEPLOYMENTS=$(cf GET "/accounts/$ACCOUNT_ID/pages/projects/$project/deployments?per_page=25")
  DEPLOY_IDS=$(echo "$DEPLOYMENTS" | python3 -c "
import json,sys
data = json.load(sys.stdin)
for d in data.get('result', []):
    print(d['id'])
" 2>/dev/null)

  PURGED=0
  while IFS= read -r did; do
    [ -z "$did" ] && continue
    cf DELETE "/accounts/$ACCOUNT_ID/pages/projects/$project/deployments/$did?force=true" > /dev/null 2>&1
    ((PURGED++)) || true
  done <<< "$DEPLOY_IDS"
  [ $PURGED -gt 0 ] && warn "  Purged $PURGED deployments from $project"

  # Delete the project
  RESULT=$(cf DELETE "/accounts/$ACCOUNT_ID/pages/projects/$project")
  if echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null; then
    ok "Deleted Pages project: $project"
  else
    MSG=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('errors',[{}])[0].get('message',''))" 2>/dev/null)
    err "Could not delete Pages project $project: $MSG"
  fi
done <<< "$ALL_PAGES"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== Step 5: Final state ==="

echo "Pages projects remaining:"
cf GET "/accounts/$ACCOUNT_ID/pages/projects?per_page=100" | python3 -c "
import json,sys
data = json.load(sys.stdin)
for p in data.get('result', []):
    domains = [d.get('domain','') for d in p.get('domains', [])]
    print(f\"  {p['name']:40s}  domains: {', '.join(domains) or '(none)'}\")
"

echo ""
echo "DNS records for admin.goldshore.ai:"
cf GET "/zones/$ZONE_GOLDSHORE_AI/dns_records?name=admin.goldshore.ai" | python3 -c "
import json,sys
data = json.load(sys.stdin)
recs = data.get('result', [])
if not recs:
    print('  (none — ready to set new custom domain on gs-admin)')
for r in recs:
    print(f\"  {r['type']} {r['name']} → {r['content']}\")
"

echo ""
ok "Cleanup complete."
echo ""
echo "Next steps:"
echo "  1. Go to Workers & Pages → gs-admin → Custom domains → Add: admin.goldshore.ai"
echo "  2. Deploy gs-trading: pnpm --filter gs-trading deploy:prod"
echo "  3. Deploy armsway-com: pnpm --filter armsway-com deploy:prod"
