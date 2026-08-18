#!/bin/bash
# Delete duplicate and deprecated GitHub Actions secrets
# Run this script from the repository root: bash ops/delete-duplicate-secrets.sh

set -e

REPO="marzton/goldshore-ai"
DRY_RUN="${1:-false}"  # Pass 'false' to actually delete, default is dry-run

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Secret Deletion Script for $REPO${NC}"
echo "Run mode: $([ "$DRY_RUN" = "false" ] && echo "EXECUTING" || echo "DRY RUN (no changes)")"
echo ""

# Secrets to delete
DUPLICATES=(
  "CLOUDFLARE_API_TOKEN"
  "GOLDSHORE_CF_TOKEN"
  "OPENAI_API_TOKEN"
  "CLOUDFLARE_BUILD_TOKEN"
  "CF_WORKERS_BUILDS"
  "CLOUDFLARE_ACCOUNT_ID"
  "CLOUDFLARE_ZONE_ID"
)

DEPRECATED=(
  "CF_AUTH_KEY"
  "CF_ACCOUNT_KEY"
)

echo -e "${YELLOW}Phase 2A: Deleting Duplicate Secrets${NC}"
for secret in "${DUPLICATES[@]}"; do
  if [ "$DRY_RUN" = "false" ]; then
    if gh secret delete "$secret" -R "$REPO" 2>/dev/null; then
      echo -e "${GREEN}✓ Deleted: $secret${NC}"
    else
      echo -e "${YELLOW}⊘ Not found or already deleted: $secret${NC}"
    fi
  else
    echo -e "${GREEN}[DRY RUN] Would delete: $secret${NC}"
  fi
done

echo ""
echo -e "${YELLOW}Phase 2B: Deleting Deprecated Secrets${NC}"
for secret in "${DEPRECATED[@]}"; do
  if [ "$DRY_RUN" = "false" ]; then
    if gh secret delete "$secret" -R "$REPO" 2>/dev/null; then
      echo -e "${GREEN}✓ Deleted: $secret${NC}"
    else
      echo -e "${YELLOW}⊘ Not found or already deleted: $secret${NC}"
    fi
  else
    echo -e "${GREEN}[DRY RUN] Would delete: $secret${NC}"
  fi
done

echo ""
echo -e "${YELLOW}Phase 2C: Auditing Unclear Secret${NC}"
UNCLEAR="GOLDSHORE_CF_TOKEN_SECRET_ACCESS_KEY"
echo -e "${YELLOW}Checking if $UNCLEAR is used in codebase...${NC}"

if grep -r "$UNCLEAR" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v ".git" | grep -v "node_modules" > /dev/null; then
  echo -e "${RED}⚠ WARNING: $UNCLEAR is referenced in code - DO NOT DELETE until purpose is confirmed${NC}"
  grep -r "$UNCLEAR" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v ".git" | grep -v "node_modules" | head -5
else
  echo -e "${GREEN}✓ $UNCLEAR is not referenced in code - SAFE TO DELETE${NC}"
  if [ "$DRY_RUN" = "false" ]; then
    if gh secret delete "$UNCLEAR" -R "$REPO" 2>/dev/null; then
      echo -e "${GREEN}✓ Deleted: $UNCLEAR${NC}"
    else
      echo -e "${YELLOW}⊘ Not found: $UNCLEAR${NC}"
    fi
  else
    echo -e "${GREEN}[DRY RUN] Would delete: $UNCLEAR${NC}"
  fi
fi

echo ""
echo -e "${YELLOW}Summary${NC}"
echo "Duplicates to delete: ${#DUPLICATES[@]}"
echo "Deprecated to delete: ${#DEPRECATED[@]}"
echo ""
if [ "$DRY_RUN" != "false" ]; then
  echo -e "${YELLOW}To execute for real, run:${NC}"
  echo "  bash ops/delete-duplicate-secrets.sh false"
else
  echo -e "${GREEN}Secrets deleted successfully!${NC}"
fi
