# Cloudflare Access Setup for Admin Dashboard

## Overview

The admin dashboard at `admin.goldshore.ai` and `admin.goldshore.org` requires Cloudflare Access to protect routes with identity verification before requests reach the gs-web Worker.

**Status:** ⚠️ Pending manual Cloudflare dashboard configuration

---

## Current Configuration

| Component | Value | Notes |
|-----------|-------|-------|
| **Account ID** | `f77de112d2019e5456a3198a8bb50bd2` | Gold Shore Labs |
| **Team Domain** | `goldshore.cloudflareaccess.com` | CF Access root domain |
| **Application ID** | `c520a7647223b49b20fbe5be240772863eb684b97b57c08955b6104c58170db9` | `admin-production` app (audience) |
| **Audience (AUD)** | `c520a7647223b49b20fbe5be240772863eb684b97b57c08955b6104c58170db9` | Used in gs-web middleware verification |
| **IdP** | GitHub (OAuth) | For identity verification |
| **Authorized Owners** | `marstonr6@gmail.com`, `admin@goldshore.org` | Bootstrap admins only |

---

## Manual Setup Steps

### Step 1: Create or Verify Access Application

**Location:** Cloudflare Dashboard → Zero Trust → Access → Applications

1. **Create new application** (if not exists):
   - **Application name:** `admin-production`
   - **Application type:** Self-hosted
   - **Subdomain:** `admin` (auto-generated or use your preference)
   - **Domain:** `goldshore.ai`
   - **Do NOT change the audience** — it's already set to the value above

2. **If application exists**, verify the **Application ID/Audience** matches:
   ```
   c520a7647223b49b20fbe5be240772863eb684b97b57c08955b6104c58170db9
   ```

### Step 2: Configure Hostnames

**Location:** Application Settings → Configure hosts

Add these hostnames to the Access application:

```
admin.goldshore.ai/*
admin.goldshore.org/*
```

(The `/*` wildcard includes all sub-paths under `/admin`)

### Step 3: Create Allow Policy (GitHub Identity)

**Location:** Application → Policies → Add Policy

1. **Policy name:** `Goldshore Admin Owners`
2. **Action:** Allow
3. **Identities:**
   - Include: `Email`
   - Add these emails:
     - `marstonr6@gmail.com`
     - `admin@goldshore.org`
4. **Require:** GitHub OAuth with verified email
5. **Save policy**

### Step 4: Create Deny Policy

**Location:** Application → Policies → Add Policy (after Allow policy)

1. **Policy name:** `Deny Everyone Else`
2. **Action:** Deny
3. **Identities:** Everyone
4. **Save policy**

**Important:** This Deny policy MUST come after the Allow policy in the policy order.

### Step 5: Verify Identity Provider (GitHub)

**Location:** Zero Trust → Settings → Authentication → GitHub

1. Confirm GitHub OAuth is configured as an identity provider
2. The Client ID and Client Secret should be set (contact platform owner if missing)
3. Note the **OAuth Application Slug** (used for IdP matching)

### Step 6: Configure Dashboard Variables

**Location:** Cloudflare Dashboard → Workers & Pages → gs-web → Production Environment

1. Go to the `gs-web` Worker's **Settings** tab
2. Set this environment variable:
   ```
   ADMIN_OWNER_EMAILS = marstonr6@gmail.com,admin@goldshore.org
   ```
3. **Important:** This must be set as a dashboard variable, NOT in `wrangler.toml`
4. Save changes (no redeploy needed; takes effect immediately)

### Step 7: Verify Logout Path

**Location:** Application Settings → Additional settings

1. Ensure the logout URL is configured correctly:
   ```
   https://admin.goldshore.ai/cdn-cgi/access/logout
   https://admin.goldshore.org/cdn-cgi/access/logout
   ```
2. These should redirect to Cloudflare's logout endpoint automatically

---

## Testing

After configuration, test in a private browser session:

### Test Case 1: Authorized User (marstonr6@gmail.com)

```bash
# Open in incognito browser
https://admin.goldshore.ai/app/dashboard

# Expected: Redirects to GitHub login
# After login with marstonr6@gmail.com: Loads admin dashboard
# Status: ✅ Access granted
```

### Test Case 2: Authorized User (admin@goldshore.org)

```bash
# Open in incognito browser
https://admin.goldshore.ai/app/dashboard

# Expected: Redirects to GitHub login
# After login with admin@goldshore.org: Loads admin dashboard
# Status: ✅ Access granted
```

### Test Case 3: Unauthorized User

```bash
# Open in incognito browser
https://admin.goldshore.ai/app/dashboard

# Expected: Redirects to GitHub login
# After login with any other account: Shows "Access Denied"
# Status: ✅ Access denied (expected behavior)
```

### Test Case 4: Logout Flow

```bash
# Navigate to
https://admin.goldshore.ai/logout

# Expected: Clears CF Access session
# Subsequent access: Requires new login
# Status: ✅ Logout working
```

---

## Code References

### gs-web middleware (authentication check)

**File:** `apps/gs-web/src/middleware.ts` (lines 60-76)

```typescript
const { env: cloudflareEnv } = await import('cloudflare:workers');
runtimeEnv = cloudflareEnv as Env;

const authResult = await authorizeAdminRequest(
  context.request,
  runtimeEnv ?? {},
  adminRule,
);
```

### Admin access verification utility

**File:** `apps/gs-web/src/utils/admin-access.ts`

Handles:
- JWT cookie verification from CF Access
- Audience (AUD) validation
- Owner email whitelist check
- Permission resolution

### gs-api audience handling

**File:** `apps/gs-api/src/index.ts`

The API proxies CF Access tokens and re-validates them server-side:
- Verifies token signature
- Checks audience against `ADMIN_PROXY_AUDIENCE`
- Resolves roles from D1 database

---

## Troubleshooting

### Symptom: 403 Forbidden on admin.goldshore.ai

**Causes:**
1. Access Application not created
2. Hostname not added to policy rules
3. Policy order reversed (Deny before Allow)
4. GitHub IdP not configured

**Fix:** Review steps 1–3 above

### Symptom: Login redirects to `/app/dashboard` without loading

**Cause:** `ADMIN_OWNER_EMAILS` environment variable not set

**Fix:** Set the variable in Cloudflare dashboard (Step 6)

### Symptom: "Invalid audience" error in browser console

**Cause:** Application audience doesn't match `CLOUDFLARE_ACCESS_AUDIENCE` in wrangler.toml

**Fix:** Verify audience in wrangler.toml matches Application ID from dashboard

### Symptom: Logout doesn't clear session

**Cause:** Logout path not configured correctly

**Fix:** Ensure `/cdn-cgi/access/logout` is reachable on the admin domain

---

## References

- **Cloudflare Access Docs:** https://developers.cloudflare.com/cloudflare-one/identity/idps/github/
- **Admin Dashboard Docs:** `docs/ADMIN_DASHBOARD.md`
- **Auth Package:** `packages/auth/src/index.ts`
- **Configuration:** `apps/gs-web/wrangler.toml` (lines 49–50)

---

## Next Steps

1. ✅ **Code is ready** — gs-web middleware and gs-api handlers are implemented
2. ⏳ **Pending dashboard setup** — Follow steps 1–7 above in Cloudflare dashboard
3. ✅ **Testing** — Run the four test cases to verify access control
4. ⏳ **Deployment** — Once configured, redeploy gs-web to activate the Access Application at the edge

