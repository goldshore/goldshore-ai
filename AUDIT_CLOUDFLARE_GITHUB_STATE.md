# Comprehensive Audit: Cloudflare & GitHub State

**Generated:** 2026-04-24  
**Updated:** 2026-06-15  
**Scope:** Live Cloudflare account (`f77de112`), GitHub repo `marzton/goldshore-ai`, routing audit docs from previous session  
**Prepared by:** Copilot / ChatGPT remediation pass

---

## Executive Summary

**Status:** Repo-side Cloudflare configuration is now partially remediated, but live Cloudflare state still needs verification.

- ✅ **Canonical source repo:** `marzton/goldshore-ai`
- ✅ **CI/CD bridge added:** `.github/workflows/deploy-cloudflare.yml`
- ✅ **Route conflict reduced:** `gs-gateway` no longer claims `api.goldshore.ai/*`
- ✅ **Domain conflict reduced:** `gs-web` infra config no longer claims `rmarston.com`
- ✅ **Canonical web owner selected:** `gs-web` owns `goldshore.ai`, `www.goldshore.ai`, `goldshore.org`, and `www.goldshore.org`
- ⚠️ **Live Cloudflare still must be checked:** Pages projects, custom domains, worker routes, and D1 migrations require Cloudflare account/API verification
- ⚠️ **Gateway live-name mismatch may remain:** repo uses `gs-gateway`; prior live audit observed `gs-platform`
- ⚠️ **Database migrations may still be unapplied:** prior audit found `gs_platform_db` and `gs_audit_db` had 0 tables

---

## Canonical Route Ownership

| Route | Canonical owner | Type | Notes |
|---|---|---|---|
| `goldshore.ai` | `gs-web` | Cloudflare Pages | Public website |
| `www.goldshore.ai` | `gs-web` | Cloudflare Pages | Public website alias |
| `goldshore.org` | `gs-web` | Cloudflare Pages | Monorepo-owned legacy/org domain |
| `www.goldshore.org` | `gs-web` | Cloudflare Pages | Monorepo-owned alias |
| `api.goldshore.ai/*` | `gs-api` | Worker | API only; removed from gateway route list |
| `gw.goldshore.ai/*` | `gs-gateway` | Worker | Gateway |
| `agent.goldshore.ai/*` | `gs-gateway` | Worker | Gateway-to-agent surface |
| `admin.goldshore.ai` | `gs-admin` | Cloudflare Pages + Access | Admin UI |
| `ops.goldshore.ai/*` | `gs-control` | Worker | Ops/control plane |
| `mail.goldshore.ai/*` | `gs-mail` | Worker | Mail worker |
| `rmarston.com` | `rmarston-com` | Separate repo/project | Not owned by `gs-web` |

---

## Repo-Side Remediation Applied

### 1. `gs-gateway` route conflict fixed

`apps/gs-gateway/wrangler.toml` no longer claims `api.goldshore.ai/*`. That route is reserved for `gs-api`.

### 2. `gs-web` domain map cleaned

`apps/gs-web/wrangler.toml` and `infra/Cloudflare/gs-web.wrangler.toml` align around these custom domains:

- `goldshore.ai`
- `www.goldshore.ai`
- `goldshore.org`
- `www.goldshore.org`

`rmarston.com` has been removed from the `gs-web` Cloudflare config and remains owned by the standalone `rmarston-com` path.

### 3. GitHub Actions deploy bridge added

`.github/workflows/deploy-cloudflare.yml` now supports:

- automatic `gs-web` Pages deployment on push to `main`
- manual deploys for `gs-web`, `gs-admin`, `gs-api`, `gs-gateway`, `gs-control`, `gs-mail`, `gs-agent`, `gs-trading`, `banproof-me`, and `armsway-com`

The workflow uses the canonical token contract:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_BUILD_API_TOKEN`

---

## Live Cloudflare Items Still Required

These cannot be honestly marked done from GitHub-only access:

1. Confirm Pages projects exist:
   - `gs-web`
   - `gs-admin`
2. Confirm custom domains are attached to the correct Pages projects.
3. Remove any old/stub custom-domain ownership from:
   - `goldshore-ai` stub worker
   - `gs-dynamic-worker`
   - any old `goldshore-org` deployment
4. Confirm worker name alignment:
   - preferred canonical name: `gs-gateway`
   - prior observed live name: `gs-platform`
5. Apply and verify D1 migrations for:
   - `gs_platform_db`
   - `gs_audit_db`
6. Confirm GitHub repo secrets exist:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_BUILD_API_TOKEN`

---

## Verification Checklist

- [ ] `curl -I https://goldshore.ai` returns HTTP 200 from `gs-web`
- [ ] `curl -I https://www.goldshore.ai` returns HTTP 200 or canonical redirect to `goldshore.ai`
- [ ] `curl -I https://goldshore.org` returns HTTP 200 or canonical redirect through `gs-web`
- [ ] `curl -I https://api.goldshore.ai/health` returns 200 from `gs-api`
- [ ] `curl -I https://gw.goldshore.ai/health` returns 200 from `gs-gateway`
- [ ] `curl -I https://admin.goldshore.ai` returns 302/auth challenge from Cloudflare Access
- [ ] D1 query confirms tables exist in `gs_platform_db`
- [ ] Worker routes in Cloudflare no longer show gateway owning `api.goldshore.ai/*`
- [ ] No `gs-web` Pages config claims `rmarston.com`
