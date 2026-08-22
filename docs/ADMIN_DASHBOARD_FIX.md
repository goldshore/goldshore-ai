# Admin Dashboard Cloudflare Access Authentication Issue

**Status:** Diagnostic complete · **Fix:** Requires manual Cloudflare dashboard action  
**Date:** 2026-08-19 · **Scope:** admin.goldshore.ai subdomain

---

## Root Cause: Missing Edge Access Application

The `admin.goldshore.ai` subdomain is routed to `gs-web` but has **no Cloudflare Access Application** configured at the edge. This prevents CF Access JWT token issuance and breaks authentication for all admin routes.

## Symptom

Nearly every `/api/admin/*` call returns **HTTP 503** with a stuck redirect to:
```
goldshore.cloudflareaccess.com/cdn-cgi/access/login/api.goldshore.ai?redirect_url=...
```

## Problem Flow

1. Browser requests `admin.goldshore.ai`
2. Cloudflare has no Access Application policy configured for this domain
3. CF Access JWT token is **never issued** to the browser
4. gs-web middleware calls `verifyAccessWithClaims()` → fails (no JWT in cookies)
5. Frontend proxy layer (api-proxy.ts) cannot extract CF Access token
6. Requests to `/api/admin/*` arrive at gs-api **without** `CF-Access-JWT-Assertion` header
7. gs-api rejects the request: `401 Unauthorized` → displayed as `503` to user

## Affected Pages (~13 total)

| Page | Route | Failing Endpoint |
|------|-------|------------------|
| Content Studio | /content | GET /api/admin/pages |
| Governance | /admin/governance | GET /api/admin/workspaces/governance |
| Projects | /admin/projects | GET /api/admin/workspaces/projects |
| MCP Access | /admin/mcp-access | GET /api/admin/mcp-assistant/catalog |
| Integrations | /admin/integrations/all | GET /api/admin/integrations?action=list |
| Ad Integrator | /admin/ads | GET /api/admin/ads/readiness |
| Sites | /sites | GET /api/admin/sites/plugins/catalog |
| Customer Email | /admin/customer-email | GET /api/admin/workspaces/email_templates |
| Email Audiences | /admin/subscribers | GET /api/admin/audiences/lists |
| Mailboxes | /admin/mailboxes | GET /api/admin/mailboxes/ |
| HostGator SQL Sync | /admin/sql-sync | GET /api/admin/sql-sync/readiness |
| Subscribe CTA | /admin/subscribe | GET /api/admin/workspaces/subscribe_ctas |
| Contact Forms | /admin/contact-forms | GET /api/admin/workspaces/email_templates |

## Solution

### Step 1: Create Missing CF Access Application

Navigate to: https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/zero-trust

**Procedure:**
1. Zero Trust → Access → Applications
2. Click "Add Application" → Select "Self-hosted"
3. Configure:
   - **Application name:** `gs-web Admin`
   - **Session duration:** 24 hours
   - **Application domain:** `admin.goldshore.ai`
   - **Subdomain:** `admin`
   - **Domain:** `goldshore.ai`
4. **Authentication policy:**
   - Allow: Email / GitHub SSO
   - Require approval: Owner/Admin
5. **Identity providers:** Enable GitHub SSO
6. Click "Save"

### Step 2: Verify

Once the Access Application is live:

1. Cloudflare will issue CF Access JWT tokens to authenticated users
2. JWT will be stored in `CF_Authorization` cookie
3. gs-web middleware will successfully verify the token
4. Frontend proxy will extract and forward the JWT to gs-api
5. gs-api will receive valid credentials and return 200 OK
6. All ~13 affected pages will load data correctly

## Code Changes Already in Place

✅ **App-level auth check** (middleware)
- File: `apps/gs-web/src/middleware.ts`
- Function: `authorizeAdminRequest()` (line 74)
- Verifies CF Access claims; returns 401 if missing

✅ **API proxy JWT extraction** (frontend proxy)
- File: `apps/gs-web/src/lib/api-proxy.ts`
- Lines 13-26: Extracts `CF_Authorization` cookie → sets `CF-Access-JWT-Assertion` header

✅ **gs-api admin request handling** (backend)
- File: `apps/gs-api/src/index.ts` (lines 196-208)
- Uses `ADMIN_PROXY_AUDIENCE` for admin requests
- Accepts Bearer tokens and CF-Access-JWT-Assertion headers

**No code changes required.** Only the edge CF Access Application configuration is needed.

## Secondary Issues (Separate Bugs)

These are independent problems requiring separate fixes:

| Issue | Page | Problem |
|-------|------|---------|
| **#2** | API Workflows | GET `/api/admin/workflows?offset=0&limit=50` returns 404 (route missing from gs-api) |
| **#3** | Repo Health | Client calls wrong endpoint; receives HTML; tries to JSON.parse() it |
| **#4** | Lead Submissions | goldshore.ai origin returns 522 Connection Timeout; no error boundary; raw HTML rendered |
| **#5** | Dashboard | Page shows "ADMIN ACCESS — Protected — Cloudflare Access identity required" (stricter CF Access policy) |

## Reference Documentation

- **Full infrastructure map:** `goldclaw/docs/cf-infrastructure.md` (lines 132-150)
- **Known issue:** "⚠ gs-web Admin — missing edge Access Application"
- **Architecture SOP:** `goldclaw/docs/architecture-sop.md`

## Timeline

- **2026-07-12:** Issue identified in PR #5618 (missing Access Application)
- **2026-08-19:** Diagnostic completed; solution documented
- **Next:** Manual CF dashboard action required (no automated API available)
