# Phase 2: GitHub Actions Secrets Consolidation — Manual Instructions

**If you prefer to delete secrets via the GitHub UI instead of using the CLI script, follow these steps:**

---

## Step 1: Navigate to GitHub Actions Secrets

1. Go to: `https://github.com/marzton/goldshore-ai`
2. Click **Settings** (top navigation)
3. Left sidebar → **Secrets and variables** → **Actions**

You should see a list of all repository secrets.

---

## Step 2A: Delete Duplicate Secrets

These 7 secrets are aliases to primary names and should be deleted:

### Duplicate List
1. **CLOUDFLARE_API_TOKEN** → alias for `CF_TOKEN`
2. **GOLDSHORE_CF_TOKEN** → alias for `CF_TOKEN`
3. **OPENAI_API_TOKEN** → alias for `OPENAI_API_KEY`
4. **CLOUDFLARE_BUILD_TOKEN** → alias for `CLOUDFLARE_BUILD_API_TOKEN`
5. **CF_WORKERS_BUILDS** → alias for `CLOUDFLARE_BUILD_API_TOKEN`
6. **CLOUDFLARE_ACCOUNT_ID** → alias for `CF_ACCOUNT_ID`
7. **CLOUDFLARE_ZONE_ID** → consolidate to `CF_ZONE_ID` or `CLOUDFLARE_GOLDSHORE_AI_ZONE_ID`

### Deletion Steps

For each secret in the list above:

1. Find the secret in the list (use Ctrl+F to search)
2. Click the **⋮** (three dots) menu on the right side
3. Select **Delete secret**
4. Confirm deletion in the popup dialog
5. Note: The secret will be removed immediately; code will use the primary name instead

**Expected outcome**: These 7 secrets disappear from the list.

---

## Step 2B: Delete Deprecated Secrets

These 2 secrets use legacy authentication methods and should be removed:

### Deprecated List
1. **CF_AUTH_KEY** — legacy global API key (superseded by `CF_TOKEN`)
2. **CF_ACCOUNT_KEY** — legacy account-level API key (superseded by `CF_TOKEN`)

### Deletion Steps

Same as above:

1. Find the secret in the list
2. Click the **⋮** (three dots) menu
3. Select **Delete secret**
4. Confirm

**Expected outcome**: These 2 secrets are deleted.

---

## Step 2C: Audit Unclear Secret

**Secret**: `GOLDSHORE_CF_TOKEN_SECRET_ACCESS_KEY`

### Purpose Assessment

Before deleting this secret, verify its purpose:

**Option A: Check if it's used in code** (recommended)

```bash
cd /home/user/goldshore-ai
grep -r "GOLDSHORE_CF_TOKEN_SECRET_ACCESS_KEY" apps/ docs/ --include="*.ts" --include="*.tsx" --include="*.md"
```

- **If found**: DO NOT DELETE — document its purpose and either consolidate or keep as-is
- **If not found**: Safe to delete

**Option B: Manual search on GitHub**

1. Go to `https://github.com/marzton/goldshore-ai`
2. Click **Code** tab
3. Use search box (top left) to search for: `GOLDSHORE_CF_TOKEN_SECRET_ACCESS_KEY`
4. If no results → Safe to delete
5. If results appear → Review before deleting

### If Safe to Delete

Follow the same deletion steps as above.

---

## Step 3: Verification

After deleting all secrets:

1. Refresh the page (Ctrl+R or Cmd+R)
2. Verify these secrets are **gone**:
   - CLOUDFLARE_API_TOKEN ✓
   - GOLDSHORE_CF_TOKEN ✓
   - OPENAI_API_TOKEN ✓
   - CLOUDFLARE_BUILD_TOKEN ✓
   - CF_WORKERS_BUILDS ✓
   - CLOUDFLARE_ACCOUNT_ID ✓
   - CLOUDFLARE_ZONE_ID ✓
   - CF_AUTH_KEY ✓
   - CF_ACCOUNT_KEY ✓

3. Verify these secrets **still exist** (primary names):
   - CF_ACCOUNT_ID ✓
   - CF_TOKEN ✓
   - CF_ZONE_ID ✓
   - OPENAI_API_KEY ✓
   - CLOUDFLARE_BUILD_API_TOKEN ✓
   - TURNSTILE_SITE_KEY ✓
   - TURNSTILE_SECRET ✓

---

## Step 4: Trigger CI to Confirm

After secrets are deleted, trigger a test deployment to confirm code uses primary names correctly:

1. Go to GitHub → **Actions** tab
2. Click **build-and-test** (or latest workflow)
3. Click **Run workflow** → **Run workflow** button
4. Wait for the workflow to complete
5. Verify: No "Missing CF_TOKEN" or "Missing CF_ACCOUNT_ID" errors in logs

---

## Troubleshooting

**If CI fails with "Missing CF_TOKEN" or similar:**

1. Check that primary secrets (CF_TOKEN, CF_ACCOUNT_ID, etc.) exist
2. If they don't exist, create them:
   - Go to Actions Secrets page
   - Click **New repository secret**
   - Enter name and value
   - Click **Add secret**

**If you accidentally delete a primary secret:**

1. Create it again immediately:
   - GitHub → Settings → Secrets → New repository secret
   - Name: `CF_TOKEN` (or the primary name)
   - Value: [copy from Cloudflare dashboard or your records]

---

## Automated Alternative

If you prefer to delete these secrets automatically using the GitHub CLI:

```bash
bash ops/delete-duplicate-secrets.sh
```

This script will:
1. List all secrets to delete (dry-run mode by default)
2. Check if unclear secrets are used in code
3. Actually delete them when you run: `bash ops/delete-duplicate-secrets.sh false`

---

## Next Phase: Rotation

After Phase 2 is complete, proceed to `ops/SECRET_CONSOLIDATION_RUNBOOK.md` for Phase 3 (rotating stale secrets).
