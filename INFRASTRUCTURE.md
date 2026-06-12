# GoldShore Infrastructure Map

> Last updated: 2026-06-12
> Account: Gold Shore Labs (f77de112d2019e5456a3198a8bb50bd2)

---

## Domain → Worker / Pages Mapping

| Domain | Type | Project / Worker | Status |
|--------|------|-----------------|--------|
| `goldshore.ai` | CF Pages | `gs-web` | ✅ Active |
| `www.goldshore.ai` | CF Worker | `gs-www-redirect` | ✅ Active (→ goldshore.ai) |
| `goldshore.org` | CF Pages | `gs-web` | ✅ Active |
| `www.goldshore.org` | CF Worker | `gs-www-redirect` | ✅ Active (→ goldshore.org) |
| `admin.goldshore.ai` | CF Pages | `gs-admin` | ⚠️ Deploy pending |
| `api.goldshore.ai` | CF Worker | `gs-api` (gs-platform proxy) | ⚠️ gs-api not deployed |
| `gw.goldshore.ai` | CF Worker | `gs-platform` | ✅ Active |
| `agent.goldshore.ai` | CF Worker | `gs-platform` / `gs-agent` | ⚠️ gs-agent not deployed |
| `trading.goldshore.ai` | CF Worker | `gs-trading` | ⚠️ Deploy pending |
| `mail.goldshore.ai` | CF Worker | `gs-mail` | ✅ Active |
| `ops.goldshore.ai` | CF Worker | `gs-control` | ⚠️ Not confirmed deployed |
| `armsway.com` | CF Worker | `armsway-com` | ⚠️ Deploy pending |
| `www.armsway.com` | CF Worker | `armsway-com` | ⚠️ Deploy pending |
| `rmarston.com` | CF Worker | `rmarston-com` (standalone) | ✅ Active (API only) |
| `www.rmarston.com` | CF Worker | `rmarston-com` / Pages | ⚠️ Needs www redirect |
| `banproof.me` | CF Worker | `banproof-me` | ✅ Active |
| `gearswipe.com` | — | Not yet configured | ❌ Not set up |

---

## DNS Records — What Each Zone Should Have

### goldshore.ai

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `goldshore.ai` | CNAME (proxied) | `gs-web.pages.dev` | Main site |
| `www` | CNAME (proxied) | worker route via `gs-www-redirect` | Redirects → goldshore.ai |
| `admin` | CNAME (proxied) | `gs-admin.pages.dev` | Admin dashboard |
| `api` | CNAME (proxied) | Worker route via `gs-platform` | API gateway |
| `gw` | CNAME (proxied) | Worker route via `gs-platform` | Gateway |
| `agent` | CNAME (proxied) | Worker route via `gs-platform` | Agent endpoint |
| `trading` | CNAME (proxied) | Worker route via `gs-trading` | Trading dashboard |
| `mail` | CNAME (proxied) | Worker route via `gs-mail` | Email queue |
| `ops` | CNAME (proxied) | Worker route via `gs-control` | Ops automation |

> **Common DNS issue**: If a Cloudflare Worker route exists for a pattern AND a Pages custom domain also points there, the worker route wins. Always remove worker routes for domains served by Pages.

### goldshore.org

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `goldshore.org` | CNAME (proxied) | `gs-web.pages.dev` | Marketing mirror |
| `www` | CNAME (proxied) | Worker route via `gs-www-redirect` | Redirects → goldshore.org |

### armsway.com

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `armsway.com` | CNAME (proxied) | Worker route via `armsway-com` | E-commerce tracking |
| `www` | CNAME (proxied) | Worker route via `armsway-com` | Same |

### rmarston.com

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `rmarston.com` | — | Pages project or Worker | Personal site (standalone) |
| `www` | CNAME (proxied) | Redirect → rmarston.com | www redirect |

> rmarston.com is fully independent from the goldshore-ai monorepo.
> The `rmarston-com` Cloudflare Worker currently only handles `/api/contact` (Resend).
> A Pages project is needed to serve the actual website content.

### banproof.me

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `banproof.me` | CNAME (proxied) | Worker route via `banproof-me` | Ban-checking API |

### gearswipe.com

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `gearswipe.com` | — | Not configured | Needs own worker/pages |

---

## Workers — Active vs. Orphaned

### ✅ Keep — Legitimate workers in this monorepo

| Worker | Source | Domain(s) |
|--------|--------|-----------|
| `banproof-me` | `apps/banproof-me` | banproof.me |
| `gs-mail` | `apps/gs-mail` | mail.goldshore.ai (queue consumer) |
| `gs-signals-prod` | `apps/gs-core-worker` (signals) | Internal |
| `gs-web` | `apps/gs-web` | goldshore.ai, goldshore.org |
| `rmarston-com` | Standalone (not in this monorepo) | rmarston.com |
| `gs-core-worker` | `apps/gs-core-worker` | Internal / stellar webhook |
| `gs-platform` | `apps/gs-platform` | gw.goldshore.ai, api proxy |

### ⚠️ Deploy — Built but not yet deployed

| Worker | Source | Deploy Command |
|--------|--------|----------------|
| `gs-trading` | `apps/gs-trading` | `pnpm --filter gs-trading deploy:prod` |
| `armsway-com` | `apps/armsway-com` | `pnpm --filter armsway-com deploy:prod` |
| `gs-admin` (Pages) | `apps/gs-admin` | `pnpm --filter gs-admin build && wrangler pages deploy dist --project-name gs-admin` |

### ❌ Delete from Cloudflare dashboard — Orphaned / outdated

| Worker | Reason | Dashboard path |
|--------|--------|----------------|
| `goldshore-ai` | Returns "Hello world" stub — no source in monorepo | Workers & Pages → goldshore-ai → ⋮ → Delete |
| `gs-web-staging` | Outdated bundled staging artifact — no wrangler.toml | Workers & Pages → gs-web-staging → ⋮ → Delete |
| `gs-todo` | Test artifact — no source in monorepo | Workers & Pages → gs-todo → ⋮ → Delete |
| `banproof` | Legacy version superseded by `banproof-me` | Confirm unused then: Workers & Pages → banproof → ⋮ → Delete |
| `banproof-email-router` | No source in monorepo — check if still needed | Workers & Pages → banproof-email-router → ⋮ → Delete if unused |

---

## D1 Databases

| Binding Name | Database Name | ID | Used By |
|---|---|---|---|
| `PLATFORM_DB` / `CONTENT_DB` / `DB` | `gs_platform_db` | `9703574e-adb7-481e-8d98-96f8ce5f8a90` | gs-platform, gs-web, gs-admin |
| `AUDIT_DB` | `gs_audit_db` | `1ae71d76-188f-481b-91d9-db2d39013f68` | gs-admin, armsway-com, banproof-me |
| `GS_AUDIT_DB` | `gs_audit_db` | same as above | armsway-com |
| `SIGNALS_DB` | `gs_signals_db` | `76af4653-7f44-417b-b46e-250143d906fd` | gs-core-worker, gs-signals-prod |
| `JOBS_DB` | `gs_jobs_db` | `750c469c-788d-49e8-9254-77231cffd70f` | gs-agent |

---

## KV Namespaces

| Title | ID | Used By |
|-------|----|---------|
| `GOLDSHORE-AI` | `5f13370575784c9dacff522121104cb3` | gs-web (KV), gs-platform (GOLDSHORE_KV) |
| `GATEWAY_KV` | `17840f9b6ac64cb1a51aeff085efe24c` | gs-platform |
| `GOLDSHORE-ADMIN` | `d02c0c7951a244a7987e23d8af16b7b2` | gs-admin (KV) |
| `KV_SESSIONS` | `d0b889d0ba314b42892f5b959356ceda` | gs-admin |
| `GS_TRADING_KV` | `9b3314c3b7af40a284a8c9b6e2990709` | gs-trading |
| `GS_TRADING_KV_PREVIEW` | `2c14b79b76e6453ab57c6dde6116a11d` | gs-trading (preview) |
| `GS_ADMIN_KV_PREVIEW` | `1f71a79b34db4090824954634dbd78c3` | gs-admin (preview) |
| `GS_API_KV` | `e0b8b807191346c3b0afc25fe716d2cd` | gs-api (when deployed) |
| `GS_CONFIG` | `68f52b467dc0413991b2195ef9081cae` | Shared config |
| `BANPROOF-ME` | `714ee6be6df54291a4a4ade053e9f9ae` | banproof-me |
| `RMARSTON-COM` | `a854b3393b5c412bb945742ecb3eda1b` | rmarston-com |
| `GOLDSHORE-ORG` | `a59a5e2f446348629f59fb21ea69d795` | goldshore-org (if separate) |

---

## Deployment Order (First-Time or After Infra Wipe)

```bash
# 1. Core infrastructure
pnpm --filter banproof-me deploy:prod
pnpm --filter gs-mail deploy:prod
pnpm --filter gs-signals-prod deploy:prod
pnpm --filter gs-core-worker deploy:prod

# 2. Gateway (depends on above service bindings)
pnpm --filter gs-platform deploy:prod

# 3. Public sites
pnpm --filter gs-web build && wrangler pages deploy ./dist --project-name gs-web
pnpm --filter gs-admin build && wrangler pages deploy dist --project-name gs-admin
pnpm --filter gs-www-redirect deploy:prod

# 4. Standalone workers
pnpm --filter gs-trading deploy:prod
pnpm --filter armsway-com deploy:prod

# 5. D1 migration (contact forms)
wrangler d1 execute gs_platform_db --file=apps/gs-web/migrations/0001_contact_forms.sql --remote

# 6. Cloudflare Pages → Custom domains
#    gs-web → goldshore.ai, goldshore.org
#    gs-admin → admin.goldshore.ai
```

---

## Notes on Separated Domains

Each domain is fully isolated from the others:

- **goldshore.ai / .org** — goldshore-ai monorepo, gs-web Pages
- **admin.goldshore.ai** — goldshore-ai monorepo, gs-admin Pages (CF Access protected)
- **trading.goldshore.ai** — goldshore-ai monorepo, gs-trading Worker (CF Access protected)
- **armsway.com** — goldshore-ai monorepo, armsway-com Worker (e-commerce / Gearswipe)
- **rmarston.com** — standalone, independent from this monorepo
- **banproof.me** — goldshore-ai monorepo (or standalone banproof repo), banproof-me Worker
- **gearswipe.com** — not yet set up; recommend a new Pages project or Worker

> **Important**: Never put multiple unrelated domains (e.g. goldshore.ai + rmarston.com) in the same Pages project custom domains list. If one project's deployment fails or gets rolled back, it takes all domains offline.
