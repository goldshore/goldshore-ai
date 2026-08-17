# Secret Consolidation & Rotation Runbook
**Date**: 2026-08-16  
**Status**: Ready for Execution  
**Audit Reference**: `/tmp/claude-0/-home-user/ddf67b16-7d57-52d9-a814-39bec2075e8a/scratchpad/goldshore-ai-secrets-audit.json`

---

## Overview

This runbook consolidates 56 goldshore-ai GitHub Actions Secrets to eliminate duplicates, remove deprecated keys, and establish a single authoritative naming convention. This prevents agentic hallucinations and reduces secret management surface area.

**Key Numbers:**
- 8 duplicates to consolidate
- 2 deprecated secrets to remove
- 1 unclear secret to audit
- 4 stale secrets to rotate (2+ months old)

---

## Phase 1: Code Changes (COMPLETED)

✅ Updated `apps/gs-api/src/types.ts` to declare primary + deprecated secret names with comments  
✅ Updated `apps/gs-api/src/routes/mcp.ts` to use `CF_TOKEN` and `CF_ACCOUNT_ID`  
✅ Updated `apps/gs-api/src/routes/system.ts` to use `CF_TOKEN` and `CF_ACCOUNT_ID`  
✅ Updated `apps/gs-api/src/routes/mcp.test.ts` to use primary names  
✅ Updated `apps/gs-api/wrangler.toml` comments to reference `CF_TOKEN` and `CF_ACCOUNT_ID`  

**Next**: Commit these changes and push to the feature branch.

---

## Phase 2: GitHub Actions Secrets Consolidation

### 2.1 Verify Current Secrets in GitHub

Go to: `marzton/goldshore-ai` → Settings → Secrets and variables → Actions

**Check that these secrets exist:**
- ✅ `CF_ACCOUNT_ID` (primary — keep as-is)
- ✅ `CF_TOKEN` (primary — keep as-is)
- ✅ `CF_ZONE_ID` (primary — keep as-is, or use `CLOUDFLARE_GOLDSHORE_AI_ZONE_ID`)
- ✅ `OPENAI_API_KEY` (primary — keep as-is)
- ✅ `CLOUDFLARE_BUILD_API_TOKEN` (primary — keep as-is)
- ✅ `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` (primary — keep as-is)
- ✅ `JWT_SECRET` (primary — keep as-is)
- ✅ `CONTROL_SYNC_TOKEN` (primary — keep as-is)

### 2.2 Delete Duplicate Secrets

**These can be deleted immediately (they are aliases to primaries):**

1. `CLOUDFLARE_API_TOKEN` — alias for `CF_TOKEN`
2. `GOLDSHORE_CF_TOKEN` — alias for `CF_TOKEN`
3. `CLOUDFLARE_ACCOUNT_ID` — alias for `CF_ACCOUNT_ID`
4. `CLOUDFLARE_ZONE_ID` — consolidate to `CF_ZONE_ID` or `CLOUDFLARE_GOLDSHORE_AI_ZONE_ID`
5. `CLOUDFLARE_BUILD_TOKEN` — alias for `CLOUDFLARE_BUILD_API_TOKEN`
6. `CF_WORKERS_BUILDS` — alias for `CLOUDFLARE_BUILD_API_TOKEN`
7. `OPENAI_API_TOKEN` — alias for `OPENAI_API_KEY`

**Steps:**
1. Open Settings → Secrets and variables → Actions
2. For each duplicate above, click ⋮ → Delete secret
3. Confirm deletion

### 2.3 Delete Deprecated Secrets

**These are legacy authentication methods and should be removed:**

1. `CF_AUTH_KEY` — legacy global API key (superseded by `CF_TOKEN`)
2. `CF_ACCOUNT_KEY` — legacy account-level API key (superseded by `CF_TOKEN`)

**Action:** Delete both from GitHub Actions Secrets

### 2.4 Audit Unclear Secret

**This secret's purpose is ambiguous:**

1. `GOLDSHORE_CF_TOKEN_SECRET_ACCESS_KEY` — Purpose unclear; check code usage

**Action:**
```bash
cd /home/user/goldshore-ai
grep -r "GOLDSHORE_CF_TOKEN_SECRET_ACCESS_KEY" apps/ --include="*.ts" --include="*.tsx"
```

**Outcome:**
- If no code references it → delete
- If code references it → document purpose and either rename to primary name or consolidate

---

## Phase 3: Secret Rotation (Stale Secrets)

These secrets were last updated 2+ months ago and should be rotated on a schedule.

### 3.1 Rotate Schwab Broker API Credentials

**Current Status**: Last updated ~2 months ago  
**Affected Files**:
- `apps/gs-trading/src/brokers/schwab.ts` (uses `SCHWAB_CLIENT_ID`, `SCHWAB_CLIENT_SECRET`)
- `apps/gs-api/src/trading/brokers/schwab.ts` (duplicate)

**Action:**
1. Log into Charles Schwab Developer Portal (OAuth 2.0 app)
2. Generate new `SCHWAB_CLIENT_ID` and `SCHWAB_CLIENT_SECRET`
3. Update GitHub Actions Secrets:
   - `SCHWAB_CLIENT_ID` ← new value
   - `SCHWAB_CLIENT_SECRET` ← new value
4. Log the rotation date in this file's audit section
5. Notify any services that depend on Schwab OAuth (currently gs-trading, gs-api)

### 3.2 Rotate Internal Dispatch Token

**Current Status**: Last updated ~2 months ago  
**Affected Files**:
- `docs/security/GATEWAY_DISPATCH_TOKEN_ROTATION.md` (references)
- `docs/manual/procedures/GATEWAY_TOKEN_ROTATION.md` (references)
- Possibly used in gateway routing logic

**Action:**
1. Generate new UUID or random token: `uuidgen` or `openssl rand -hex 32`
2. Update GitHub Actions Secret:
   - `GS_DISPATCH_TOKEN` ← new value
3. Update any gateway configuration that references this token
4. Deploy the change
5. Log rotation date

### 3.3 Verify Cloudflare CA Origin Key

**Current Status**: Last updated ~2 months ago  
**Affected Files**:
- No explicit code references found in gs-api or gs-web
- Likely used for mutual TLS or origin certificate verification

**Action:**
1. Check Cloudflare dashboard → SSL/TLS → Origin Server → Certificates
2. Verify the current origin certificate is still valid
3. If expiring within 30 days, generate a new one
4. Update `CLOUDFLARE_CA_ORIGIN_KEY` with new certificate key
5. Deploy and test

---

## Phase 4: Validation & Testing

### 4.1 Local Testing

```bash
# Install dependencies
pnpm install

# Type-check gs-api to verify secret name usage
pnpm --filter gs-api tsc --noEmit

# Run gs-api tests
pnpm --filter gs-api test

# Lint to catch any remaining references
pnpm --filter gs-api lint
```

### 4.2 CI/CD Validation

1. Push the feature branch with code changes (Phase 1)
2. Wait for GitHub Actions CI to pass:
   - ✅ Type-check
   - ✅ Build
   - ✅ Test
   - ✅ Lint
3. Once CI passes, proceed to Phase 3 (secret updates in GitHub Actions UI)
4. Redeploy to preview/staging to confirm secrets resolve correctly

### 4.3 Production Deployment

Only after CI passes and preview deployment confirms:

1. Merge feature branch to main (via PR)
2. Deploy to production via GitHub Actions
3. Monitor logs for any "Missing CF_TOKEN" or "Missing CF_ACCOUNT_ID" errors
4. If errors occur, rollback and check GitHub Actions Secrets are populated correctly

---

## Phase 5: Documentation & Audit Trail

### 5.1 Update Secret Inventory

After all changes complete, update:
- `docs/secrets-reference.md` — list authoritative secret names
- `infra/Cloudflare/AUDIT_2026-04-04.md` — add consolidation audit entry
- This runbook (`ops/SECRET_CONSOLIDATION_RUNBOOK.md`) — mark as complete with date

### 5.2 Record in Audit Log

Add entry to compliance audit trail:

```
Date: 2026-08-16
Action: Secret consolidation and rotation
Changes:
  - Consolidated 8 duplicate secrets → 1 primary per use case
  - Deleted 2 deprecated secrets (CF_AUTH_KEY, CF_ACCOUNT_KEY)
  - Rotated 4 stale secrets (SCHWAB_*, GS_DISPATCH_TOKEN, CLOUDFLARE_CA_ORIGIN_KEY)
  - Updated code to use primary secret names only
  - Updated types.ts, mcp.ts, system.ts, wrangler.toml
Status: Complete
Verified By: [Agent Name]
```

---

## Execution Checklist

### Code & Commit
- [ ] Phase 1 changes are committed and pushed to feature branch
- [ ] CI passes (type-check, build, test, lint)

### GitHub Actions Secrets
- [ ] Deleted 7 duplicate secrets (CLOUDFLARE_API_TOKEN, GOLDSHORE_CF_TOKEN, etc.)
- [ ] Deleted 2 deprecated secrets (CF_AUTH_KEY, CF_ACCOUNT_KEY)
- [ ] Audited `GOLDSHORE_CF_TOKEN_SECRET_ACCESS_KEY` for usage

### Rotation
- [ ] Rotated SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET
- [ ] Rotated GS_DISPATCH_TOKEN (with gateway reconfig)
- [ ] Verified/rotated CLOUDFLARE_CA_ORIGIN_KEY
- [ ] Logged all rotation dates below

### Testing & Deployment
- [ ] Local type-check, build, test, lint all pass
- [ ] Preview deployment confirms secrets resolve
- [ ] Production deployment succeeds
- [ ] No "Missing secret" errors in production logs

### Documentation
- [ ] Updated docs/secrets-reference.md
- [ ] Updated infra/Cloudflare/AUDIT_2026-04-04.md
- [ ] Added entry to compliance audit trail
- [ ] Marked this runbook as Complete

---

## Secret Rotation Audit Trail

| Secret Name | Last Rotated | Rotated By | Next Scheduled |
|-------------|--------------|-----------|-----------------|
| SCHWAB_CLIENT_ID | [TBD] | [Name] | Q4 2026 |
| SCHWAB_CLIENT_SECRET | [TBD] | [Name] | Q4 2026 |
| GS_DISPATCH_TOKEN | [TBD] | [Name] | Q4 2026 |
| CLOUDFLARE_CA_ORIGIN_KEY | [TBD] | [Name] | Q4 2026 |

---

## Rollback Plan

If issues arise during any phase:

1. **Before Phase 3 (GitHub Actions updates)**: Revert code changes via git revert and reopen PR for review
2. **After Phase 3**: If secrets cause production issues:
   - Restore deleted secret values from git history or previous backups
   - Revert code changes
   - Redeploy previous version
   - Open incident ticket

---

## Questions & Support

For unclear secrets or integration-specific questions:
- Check `docs/INFRASTRUCTURE.md` for binding context
- Search `apps/gs-api/src/` for code references
- Review `infra/Cloudflare/BINDINGS_MAP.md` for Cloudflare resource mapping
- Consult CLAUDE.md for domain-specific architecture notes

---

**Status**: ✅ Ready to execute Phase 2 (GitHub Actions Secrets consolidation)

Next Step: Proceed to Phase 2 once feature branch is merged and CI passes.
