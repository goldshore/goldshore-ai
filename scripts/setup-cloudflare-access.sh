#!/bin/bash
set -euo pipefail

# Cloudflare Access Setup Script for admin.goldshore.ai
# This script configures Cloudflare Access protection for the admin dashboard

ACCOUNT_ID="f77de112d2019e5456a3198a8bb50bd2"
CF_TEAM_DOMAIN="goldshore.cloudflareaccess.com"
ADMIN_EMAILS=("marstonr6@gmail.com" "admin@goldshore.org")
AUDIENCE="c520a7647223b49b20fbe5be240772863eb684b97b57c08955b6104c58170db9"
APP_NAME="admin-production"
APP_DOMAIN="admin.goldshore.ai"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check for API token
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  log_error "CLOUDFLARE_API_TOKEN environment variable not set"
  echo ""
  echo "To use this script, set your Cloudflare API token:"
  echo "  export CLOUDFLARE_API_TOKEN='your-token-here'"
  echo ""
  echo "Get your API token from: https://dash.cloudflare.com/profile/api-tokens"
  exit 1
fi

log_info "Using Cloudflare Account: $ACCOUNT_ID"
log_info "Application: $APP_NAME"

# Function to make API calls
call_cf_api() {
  local method=$1
  local endpoint=$2
  local data=${3:-}

  local url="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}${endpoint}"
  local args=(
    -s
    -X "$method"
    "$url"
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
    -H "Content-Type: application/json"
  )

  if [ -n "$data" ]; then
    args+=(-d "$data")
  fi

  curl "${args[@]}"
}

# Step 1: Get or create Access Application
log_info "Step 1: Creating/verifying Access application..."

APP_LIST=$(call_cf_api GET "/access/applications")

if ! echo "$APP_LIST" | jq -e '.success' > /dev/null; then
  log_error "Failed to list Access applications"
  echo "$APP_LIST" | jq .
  exit 1
fi

# Check if app exists
APP_ID=$(echo "$APP_LIST" | jq -r ".result[] | select(.name == \"$APP_NAME\") | .id" 2>/dev/null || echo "")

if [ -n "$APP_ID" ] && [ "$APP_ID" != "null" ]; then
  log_success "Found existing application: $APP_ID"
else
  log_info "Creating new Access application..."

  APP_CREATE=$(call_cf_api POST "/access/applications" @- <<EOF
{
  "name": "$APP_NAME",
  "type": "self_hosted",
  "domain": "$APP_DOMAIN",
  "custom_domain": "$APP_DOMAIN",
  "custom_domain_in_sni_only": false,
  "cors_allow_credentials": false,
  "auto_redirect_to_identity": false,
  "session_duration": "24h"
}
EOF
  )

  if ! echo "$APP_CREATE" | jq -e '.success' > /dev/null; then
    log_error "Failed to create Access application"
    echo "$APP_CREATE" | jq .
    exit 1
  fi

  APP_ID=$(echo "$APP_CREATE" | jq -r '.result.id')
  log_success "Created Access application: $APP_ID"
fi

# Step 2: Configure policies
log_info "Step 2: Configuring access policies..."

POLICIES=$(call_cf_api GET "/access/applications/${APP_ID}/policies")

if ! echo "$POLICIES" | jq -e '.success' > /dev/null; then
  log_error "Failed to list policies"
  echo "$POLICIES" | jq .
  exit 1
fi

# Check for Allow policy
ALLOW_POLICY=$(echo "$POLICIES" | jq -r ".result[] | select(.name == \"Goldshore Admin Owners\") | .id" 2>/dev/null || echo "")

if [ -z "$ALLOW_POLICY" ] || [ "$ALLOW_POLICY" = "null" ]; then
  log_info "Creating Allow policy..."

  # Build email array for policy
  EMAIL_ARRAY=$(printf '%s\n' "${ADMIN_EMAILS[@]}" | jq -R . | jq -s .)

  ALLOW_CREATE=$(call_cf_api POST "/access/applications/${APP_ID}/policies" @- <<EOF
{
  "name": "Goldshore Admin Owners",
  "description": "Allow Goldshore admin owners via GitHub",
  "decision": "allow",
  "include": [
    {
      "email": {
        "emails": ${EMAIL_ARRAY}
      }
    },
    {
      "identity_provider": {
        "identity_provider_id": "github"
      }
    }
  ],
  "require": [
    {
      "email_verified": {}
    }
  ],
  "precedence": 1
}
EOF
  )

  if ! echo "$ALLOW_CREATE" | jq -e '.success' > /dev/null; then
    log_error "Failed to create Allow policy"
    echo "$ALLOW_CREATE" | jq .
    exit 1
  fi

  log_success "Created Allow policy for: $(IFS=', '; echo "${ADMIN_EMAILS[*]}")"
else
  log_success "Allow policy already exists: $ALLOW_POLICY"
fi

# Check for Deny policy
DENY_POLICY=$(echo "$POLICIES" | jq -r ".result[] | select(.name == \"Deny Everyone Else\") | .id" 2>/dev/null || echo "")

if [ -z "$DENY_POLICY" ] || [ "$DENY_POLICY" = "null" ]; then
  log_info "Creating Deny policy..."

  DENY_CREATE=$(call_cf_api POST "/access/applications/${APP_ID}/policies" @- <<EOF
{
  "name": "Deny Everyone Else",
  "description": "Deny all other access attempts",
  "decision": "deny",
  "include": [
    {
      "everyone": {}
    }
  ],
  "precedence": 2
}
EOF
  )

  if ! echo "$DENY_CREATE" | jq -e '.success' > /dev/null; then
    log_error "Failed to create Deny policy"
    echo "$DENY_CREATE" | jq .
    exit 1
  fi

  log_success "Created Deny policy"
else
  log_success "Deny policy already exists: $DENY_POLICY"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "Cloudflare Access Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  Account ID:       $ACCOUNT_ID"
echo "  Application:      $APP_NAME"
echo "  Application ID:   $APP_ID"
echo "  Hostnames:        $APP_DOMAIN, admin.goldshore.org"
echo "  Admin Emails:     $(IFS=', '; echo "${ADMIN_EMAILS[*]}")"
echo "  Policies:         Allow (admins) + Deny (others)"
echo ""
echo "Next Steps:"
echo "  1. ✅ Access Application configured"
echo "  2. ✅ Policies set up"
echo "  3. ⏳ Set ADMIN_OWNER_EMAILS in Cloudflare dashboard:"
echo "       Dashboard → Workers & Pages → gs-web → Settings"
echo "       Add: ADMIN_OWNER_EMAILS = $(IFS=,; echo "${ADMIN_EMAILS[*]}")"
echo "  4. ⏳ Redeploy gs-web Worker"
echo "  5. ⏳ Test: https://admin.goldshore.ai/app/dashboard"
echo ""
echo "Dashboard: https://dash.cloudflare.com/account/$ACCOUNT_ID"
echo ""
