#!/bin/bash
# GoldShore Labs — Live State Audit Script
# Purpose: Verify Cloudflare account and GitHub repo are aligned
# Authority: marzton (account owner + GitHub)
# Prerequisites: wrangler CLI + jq + gh CLI (GitHub), valid CF/GH credentials

set -euo pipefail

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GoldShore Labs — Live State Audit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for required tools
for cmd in wrangler jq gh; do
  if ! command -v "$cmd" &> /dev/null; then
    echo -e "${RED}✗${NC} $cmd not found. Install it and try again."
    exit 1
  fi
done

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-f77de112}"
FAILED=0
PASSED=0

# ──────────────────────────────────────────────────────────────────────────
# 1. Check Workers
# ──────────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}1. Workers on Cloudflare Account${NC}"

WORKERS=$(wrangler deployments list --outdir=/tmp/wrangler-audit 2>/dev/null || echo "error")

if [[ "$WORKERS" == "error" ]]; then
  echo -e "${RED}✗${NC} Failed to list workers. Check CLOUDFLARE_ACCOUNT_ID and credentials."
  FAILED=$((FAILED + 1))
else
  EXPECTED_WORKERS=("gs-api" "gs-platform" "gs-gateway" "gs-control" "gs-mail" "gs-agent" "banproof-me")
  for worker in "${EXPECTED_WORKERS[@]}"; do
    if wrangler deployments list --name="$worker" 2>/dev/null | grep -q "$worker"; then
      echo -e "${GREEN}✓${NC} $worker deployed"
      PASSED=$((PASSED + 1))
    else
      if [[ "$worker" == "gs-control" || "$worker" == "gs-mail" || "$worker" == "gs-agent" ]]; then
        echo -e "${YELLOW}⚠${NC} $worker not deployed (expected — deploy pending)"
        PASSED=$((PASSED + 1))
      else
        echo -e "${RED}✗${NC} $worker missing"
        FAILED=$((FAILED + 1))
      fi
    fi
  done
fi

# ──────────────────────────────────────────────────────────────────────────
# 2. Check D1 Databases
# ──────────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}2. D1 Databases${NC}"

for db in gs_platform_db gs_audit_db; do
  TABLE_COUNT=$(wrangler d1 info "$db" 2>/dev/null | grep -i "tables" | awk '{print $NF}' || echo "0")
  if [[ "$TABLE_COUNT" -eq 0 ]]; then
    echo -e "${RED}✗${NC} $db has 0 tables (migrations not applied)"
    FAILED=$((FAILED + 1))
  else
    echo -e "${GREEN}✓${NC} $db has $TABLE_COUNT tables"
    PASSED=$((PASSED + 1))
  fi
done

# ──────────────────────────────────────────────────────────────────────────
# 3. Check R2 Buckets
# ──────────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}3. R2 Buckets${NC}"

EXPECTED_BUCKETS=("gs-assets" "gs-assets-preview" "gs-telemetry-storage")
for bucket in "${EXPECTED_BUCKETS[@]}"; do
  if wrangler r2 bucket list | grep -q "$bucket"; then
    echo -e "${GREEN}✓${NC} $bucket exists"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗${NC} $bucket missing"
    FAILED=$((FAILED + 1))
  fi
done

# ──────────────────────────────────────────────────────────────────────────
# 4. Check KV Namespaces
# ──────────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}4. KV Namespaces${NC}"

EXPECTED_KV=("gs_api_kv_001" "goldshore-gw-kv" "gs-ai-cache")
for ns in "${EXPECTED_KV[@]}"; do
  if wrangler kv:namespace list | grep -q "$ns"; then
    echo -e "${GREEN}✓${NC} $ns exists"
    PASSED=$((PASSED + 1))
  else
    echo -e "${YELLOW}⚠${NC} $ns not found (may not be critical)"
  fi
done

# ──────────────────────────────────────────────────────────────────────────
# 5. Check gs-platform Security Settings
# ──────────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}5. gs-platform Security${NC}"

# Check if CLOUDFLARE_ACCESS_AUDIENCE is set
if wrangler secret list --name=gs-platform 2>/dev/null | grep -q "CLOUDFLARE_ACCESS_AUDIENCE"; then
  echo -e "${GREEN}✓${NC} CLOUDFLARE_ACCESS_AUDIENCE is set"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗${NC} CLOUDFLARE_ACCESS_AUDIENCE not configured (CRITICAL)"
  FAILED=$((FAILED + 1))
fi

# ──────────────────────────────────────────────────────────────────────────
# 6. Check Auth Package Safety
# ──────────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}6. Auth Package (JWT Verification)${NC}"

if [[ -f packages/auth/verify.ts ]]; then
  # Check if jose is imported
  if grep -q "jose" packages/auth/verify.ts; then
    echo -e "${GREEN}✓${NC} packages/auth/verify.ts uses jose library"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗${NC} packages/auth/verify.ts does not import jose (JWT bypass risk)"
    FAILED=$((FAILED + 1))
  fi
  
  # Check if jwtVerify is used
  if grep -q "jwtVerify" packages/auth/verify.ts; then
    echo -e "${GREEN}✓${NC} jwtVerify function called"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗${NC} jwtVerify not found (JWT bypass risk)"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${RED}✗${NC} packages/auth/verify.ts not found"
  FAILED=$((FAILED + 1))
fi

# ──────────────────────────────────────────────────────────────────────────
# 7. Check Repository Structure
# ──────────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}7. Repository Structure${NC}"

EXPECTED_DIRS=("apps/gs-web" "apps/gs-api" "infra/Cloudflare" "packages/auth")
for dir in "${EXPECTED_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    echo -e "${GREEN}✓${NC} $dir exists"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗${NC} $dir missing"
    FAILED=$((FAILED + 1))
  fi
done

# ──────────────────────────────────────────────────────────────────────────
# 8. Check for banproof-me in monorepo
# ──────────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}8. BanProof Integration${NC}"

if [[ -d "apps/banproof-me" ]]; then
  echo -e "${GREEN}✓${NC} apps/banproof-me exists in monorepo"
  PASSED=$((PASSED + 1))
else
  echo -e "${YELLOW}⚠${NC} apps/banproof-me not in monorepo (separate deployment)"
  echo "     → Action: Migrate to monorepo for CI/CD integration"
fi

# ──────────────────────────────────────────────────────────────────────────
# 9. Check CI Workflow Token Usage
# ──────────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}9. CI/CD Token Policy${NC}"

FALLBACK_COUNT=$(grep -r "CLOUDFLARE_BUILD_API_TOKEN.*||.*CLOUDFLARE_API_TOKEN" .github/workflows/ 2>/dev/null | wc -l || echo "0")
if [[ "$FALLBACK_COUNT" -gt 0 ]]; then
  echo -e "${RED}✗${NC} Found $FALLBACK_COUNT workflow(s) with fallback token expressions"
  FAILED=$((FAILED + 1))
else
  echo -e "${GREEN}✓${NC} No fallback token expressions found"
  PASSED=$((PASSED + 1))
fi

# ──────────────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────────────
echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}✓ Passed: $PASSED${NC}  |  ${RED}✗ Failed: $FAILED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $FAILED -gt 0 ]]; then
  echo -e "\n${RED}Action Required:${NC}"
  echo "  1. Fix critical security issue: Set CLOUDFLARE_ACCESS_AUDIENCE on gs-platform"
  echo "  2. Apply D1 migrations: wrangler d1 migrations apply gs_platform_db --remote"
  echo "  3. Deploy missing workers: gs-control, gs-mail, gs-agent"
  echo "  4. Reconcile gs-platform vs gs-gateway naming"
  exit 1
else
  echo -e "\n${GREEN}All checks passed!${NC}"
  exit 0
fi
