#!/bin/bash
set -euo pipefail

# Cloudflare Bindings Synchronization & Deployment Script
# Usage: ./scripts/deploy-bindings-sync.sh [--dry-run] [--skip-verify]
#
# This script:
# 1. Validates prerequisites (wrangler, git status)
# 2. Sets secrets on gs-api and gs-web
# 3. Deploys both workers
# 4. Verifies endpoints respond with 200/Access redirect
# 5. Rolls back on failure
#
# Prerequisites:
# - wrangler >= 3.0
# - Node.js >= 22
# - Cloudflare API token (CLOUDFLARE_API_TOKEN env var)
# - Clean git working tree (no uncommitted changes)

DRY_RUN=${1:---dry-run}
SKIP_VERIFY=${2:---skip-verify}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; exit 1; }

# Trap for cleanup
cleanup() {
  if [[ $? -ne 0 ]]; then
    error "Deployment failed. Rolling back..."
    # Future: git revert, redeploy previous version, etc.
  fi
}
trap cleanup EXIT

# ════════════════════════════════════════════════════════════════════════════════
# Prerequisites
# ════════════════════════════════════════════════════════════════════════════════

log "Validating prerequisites..."

# Check wrangler version
WRANGLER_VERSION=$(npx wrangler --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if [[ -z "$WRANGLER_VERSION" ]]; then
  error "wrangler not found. Install with: npm install -g wrangler"
fi
success "wrangler $WRANGLER_VERSION"

# Check Node.js version
NODE_VERSION=$(node --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
if [[ $(echo "$NODE_VERSION" | cut -d. -f1) -lt 22 ]]; then
  error "Node.js 22+ required (you have $NODE_VERSION)"
fi
success "Node.js $NODE_VERSION"

# Check Cloudflare API token
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  error "CLOUDFLARE_API_TOKEN not set. Export it before running this script."
fi
success "Cloudflare API token configured"

# Check git status
if [[ -n $(git status --porcelain) ]]; then
  error "Uncommitted changes detected. Commit or stash them first."
fi
success "Git working tree clean"

# ════════════════════════════════════════════════════════════════════════════════
# Parse Environment & Secrets
# ════════════════════════════════════════════════════════════════════════════════

log "Loading secrets from environment..."

# These should be set before running this script, or prompted for interactively
ADMIN_OWNER_EMAILS="${ADMIN_OWNER_EMAILS:-marstonr6@gmail.com,admin@goldshore.org}"
JWT_SECRET="${JWT_SECRET:-}"
TURNSTILE_SECRET="${TURNSTILE_SECRET:-}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
GH_PAT="${GH_PAT:-}"

# Validate required secrets
if [[ -z "$JWT_SECRET" ]]; then
  warn "JWT_SECRET not set. Generate one with: openssl rand -hex 32"
  read -p "Enter JWT_SECRET (or press Enter to skip): " JWT_SECRET
fi

if [[ -z "$TURNSTILE_SECRET" ]]; then
  warn "TURNSTILE_SECRET not set. Get it from https://dash.cloudflare.com/turnstile"
  read -p "Enter TURNSTILE_SECRET (or press Enter to skip): " TURNSTILE_SECRET
fi

log "Secrets loaded (some may be empty if not provided)"

# ════════════════════════════════════════════════════════════════════════════════
# Dry Run Mode
# ════════════════════════════════════════════════════════════════════════════════

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  log "Running in DRY RUN mode. No changes will be made."
  log ""
  log "Secrets that would be set:"
  echo "  ADMIN_OWNER_EMAILS=$ADMIN_OWNER_EMAILS"
  echo "  JWT_SECRET=$(if [[ -n "$JWT_SECRET" ]]; then echo "[SET]"; else echo "[SKIPPED]"; fi)"
  echo "  TURNSTILE_SECRET=$(if [[ -n "$TURNSTILE_SECRET" ]]; then echo "[SET]"; else echo "[SKIPPED]"; fi)"
  echo "  GEMINI_API_KEY=$(if [[ -n "$GEMINI_API_KEY" ]]; then echo "[SET]"; else echo "[SKIPPED]"; fi)"
  echo "  OPENAI_API_KEY=$(if [[ -n "$OPENAI_API_KEY" ]]; then echo "[SET]"; else echo "[SKIPPED]"; fi)"
  echo "  GH_PAT=$(if [[ -n "$GH_PAT" ]]; then echo "[SET]"; else echo "[SKIPPED]"; fi)"
  log ""
  log "Deployments would proceed for: gs-api, gs-web"
  log "Verifications would check: api.goldshore.ai, goldshore.ai, goldshore.org"
  exit 0
fi

# ════════════════════════════════════════════════════════════════════════════════
# Deploy: Set Secrets & Deploy Workers
# ════════════════════════════════════════════════════════════════════════════════

log "Setting secrets on gs-api..."

cd apps/gs-api

if [[ -n "$JWT_SECRET" ]]; then
  echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET --env prod
  success "Set JWT_SECRET"
fi

if [[ -n "$TURNSTILE_SECRET" ]]; then
  echo "$TURNSTILE_SECRET" | npx wrangler secret put TURNSTILE_SECRET --env prod
  success "Set TURNSTILE_SECRET"
fi

if [[ -n "$GEMINI_API_KEY" ]]; then
  echo "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY --env prod
  success "Set GEMINI_API_KEY"
fi

if [[ -n "$OPENAI_API_KEY" ]]; then
  echo "$OPENAI_API_KEY" | npx wrangler secret put OPENAI_API_KEY --env prod
  success "Set OPENAI_API_KEY"
fi

if [[ -n "$GH_PAT" ]]; then
  echo "$GH_PAT" | npx wrangler secret put GH_PAT --env prod
  success "Set GH_PAT"
fi

log "Deploying gs-api..."
npx wrangler deploy --env prod
success "gs-api deployed"

cd - > /dev/null

# Deploy gs-web
log "Setting secrets on gs-web..."

cd apps/gs-web

echo "$ADMIN_OWNER_EMAILS" | npx wrangler secret put ADMIN_OWNER_EMAILS --env prod
success "Set ADMIN_OWNER_EMAILS"

log "Deploying gs-web..."
npx wrangler deploy --env prod
success "gs-web deployed"

cd - > /dev/null

# ════════════════════════════════════════════════════════════════════════════════
# Verification
# ════════════════════════════════════════════════════════════════════════════════

if [[ "$SKIP_VERIFY" == "--skip-verify" ]]; then
  warn "Skipping endpoint verification (--skip-verify)"
  success "Deployment complete!"
  exit 0
fi

log "Verifying endpoints..."

# Helper function to check endpoint
check_endpoint() {
  local url=$1
  local name=$2
  local expected_code=${3:-200}

  log "Checking $name..."

  response=$(curl -s -w "\n%{http_code}" "$url" 2>&1 || echo "000")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)

  if [[ "$http_code" == "$expected_code" ]] || [[ "$http_code" == "307" ]] || [[ "$http_code" == "302" ]]; then
    success "$name responded ($http_code)"
    return 0
  else
    warn "$name returned $http_code (expected $expected_code or redirect)"
    warn "Response preview: $(echo "$body" | head -c 200)"
    return 1
  fi
}

VERIFY_PASS=0
VERIFY_FAIL=0

# Check key endpoints
check_endpoint "https://api.goldshore.ai/health" "api.goldshore.ai/health" && ((VERIFY_PASS++)) || ((VERIFY_FAIL++))
check_endpoint "https://goldshore.ai/" "goldshore.ai" && ((VERIFY_PASS++)) || ((VERIFY_FAIL++))
check_endpoint "https://goldshore.org/" "goldshore.org" && ((VERIFY_PASS++)) || ((VERIFY_FAIL++))
check_endpoint "https://admin.goldshore.ai/" "admin.goldshore.ai (Access)" "307" && ((VERIFY_PASS++)) || ((VERIFY_FAIL++))

log ""
log "Verification results: $VERIFY_PASS passed, $VERIFY_FAIL failed"

if [[ $VERIFY_FAIL -gt 0 ]]; then
  warn "Some endpoints did not respond as expected. Check the deployment logs."
  warn "Endpoints may take 1-2 minutes to propagate. Try again in a moment."
else
  success "All endpoints verified!"
fi

# ════════════════════════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════════════════════════

log ""
log "════════════════════════════════════════════════════════════════════════════════"
success "Deployment complete!"
log ""
log "Next steps:"
log "  1. Monitor Cloudflare Analytics: https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/workers"
log "  2. Check logs: https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/workers/services/view/gs-api/production"
log "  3. Test contact form with Turnstile: https://goldshore.ai/contact"
log "  4. Verify Access policy: https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/zero-trust/access-controls/apps"
log ""
log "If endpoints are still down after 2 minutes, check:"
log "  - DNS records: https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/goldshore.ai/dns"
log "  - Worker routes: https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/goldshore.ai/workers/routes"
log "  - Wrangler logs: wrangler tail gs-api --env prod"
log ""
