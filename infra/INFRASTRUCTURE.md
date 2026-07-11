# Gold Shore Labs — Canonical Infrastructure Manifest

> **This file is the source of truth. No AI agent, no PR, no human may change
> Cloudflare resources without a corresponding change to this file passing CI.**
>
> Last certified: 2026-04-29 | Certified by: Rob Marston (@marzton)
> Repo alignment pass: 2026-06-30 | `goldshore.org` apex ownership moved to `gs-web-app`; `www.goldshore.org` ownership moved to `gs-www-redirect-prod`.

---

## Account

| Key | Value |
|---|---|
| Account ID | `f77de112d2019e5456a3198a8bb50bd2` |
| Subdomain | `goldshore.workers.dev` |
| Account name | Gold Shore Labs |

---

## Workers (canonical set — 32 active)

| Worker name | Purpose | Domains served | Fail policy |
|---|---|---|---|
| `gs-platform` | Platform hub — internal service-binding traffic only (routes removed from prod) | — | Fail closed on auth routes |
| `gs-api` | API layer | api.goldshore.ai | Fail closed |
| `gs-api-preview` | Preview environment for gs-api | — | Fail closed |
| `gs-admin` | Admin dashboard worker | admin.goldshore.ai | Fail closed |
| `gs-gateway` | Legacy gateway placeholder (deployed from goldshore-gateway repo) | gw.goldshore.ai, agent.goldshore.ai | Fail closed |
| `gs-gateway-prod` | Production-env deployment of gs-gateway (`wrangler --env prod`) | gw.goldshore.ai, agent.goldshore.ai | Fail closed |
| `gs-agent` | AI agent worker | — | Fail closed |
| `gs-agent-prod` | Production-env deployment of gs-agent (`wrangler --env prod`) | — | Fail closed |
| `gs-control` | Build control service | — | Fail closed |
| `goldshore-org` | Legacy goldshore.org redirect worker, superseded by `gs-web-app` + `gs-www-redirect-prod` for current public `.org` routing | — | Fail open (public) |
| `banproof-me` | Proof-of-Agency security layer, contact forms, PoA workflow | banproof.me | Fail closed |
| `banproof-email-router` | Email routing for banproof | — | Fail closed |
| `gs-core-worker` | Gearswipe/StellarAIO ATC trigger, signals consumer | — | Fail closed |
| `gs-core-worker-prod` | Production-env deployment of gs-core-worker (`wrangler --env prod`) | — | Fail closed |
| `gs-signals-prod` | Polygon sentiment analysis, signal generation | — | Fail closed |
| `gs-mail` | Transactional mail dispatch | — | Fail closed |
| `gs-web` | goldshore.ai frontend static assets (superseded by gs-web-app) | — | Fail open (public) |
| `gs-web-preview` | Preview environment for gs-web (`wrangler --env preview`) | preview.goldshore.ai | Fail open |
| `gs-web-staging` | Staging variant of gs-web | staging.goldshore.ai | Fail open |
| `rmarston-com` | rmarston.com personal site | rmarston.com | Fail open (public) |
| `goldshore-ai` | (Audit pending — may be stub) | — | TBD |
| `gs-todo` | (Audit pending — may be internal tool) | — | TBD |
| `gs-trading` | Schwab + Robinhood brokerage integration, trading API, risk engine | — | Fail closed |
| `gs-trading-prod` | Production-env deployment of gs-trading (`wrangler --env prod`) | trading.goldshore.ai | Fail closed |
| `armsway-com` | armsway.com site worker | armsway.com | Fail open (public) |
| `armsway-com-prod` | Production-env deployment of armsway-com (`wrangler --env prod`) | armsway.com, www.armsway.com | Fail open (public) |
| `gs-www-redirect` | www → apex redirect worker | www.goldshore.ai, www.goldshore.org | Fail open |
| `gs-www-redirect-prod` | Production-env deployment of gs-www-redirect (`wrangler --env production`) | www.goldshore.ai, www.goldshore.org | Fail open |
| `banproof` | BanProof legacy worker | — | Fail closed |
| `partners-in-pools` | Matteo's pool business client site (partnersinpools.com) | partnersinpools.com | Fail open (public) |
| `gs-mcp` | MCP server — Model Context Protocol endpoint for AI agent tooling | — | Fail closed |
| `gs-web-app` | Main web application worker for goldshore.ai and goldshore.org apex | goldshore.ai, goldshore.org | Fail open (public) |

**Workers NOT on this list must not exist. Any live worker absent from this table will fail the CI audit. See Gate 1 below.**

---

## D1 Databases

| Name | ID | Tables | Purpose |
|---|---|---|---|
| `gs_platform_db` | `9703574e-adb7-481e-8d98-96f8ce5f8a90` | users, subscriptions, domains, contact_submissions, api_keys, content, form_configs, media_assets, platform_config, schema_migrations, worker_registry, workflow_jobs + more | Core platform data |
| `gs_audit_db` | `1ae71d76-188f-481b-91d9-db2d39013f68` | audit_log, poa_jobs, schema_migrations | Audit trail, PoA jobs |
| `gs_signals_db` | `76af4653-7f44-417b-b46e-250143d906fd` | signals, signal_subscriptions, schema_migrations | Trading signals |

---

## KV Namespaces

| Binding name | CF title | ID | Used by |
|---|---|---|---|
| `GATEWAY_KV` | GATEWAY_KV | `17840f9b6ac64cb1a51aeff085efe24c` | gs-platform audit logging |
| `GOLDSHORE_KV` | GOLDSHORE-AI | `5f13370575784c9dacff522121104cb3` | gs-platform config |
| `BANPROOF_KV` | BANPROOF-ME | `714ee6be6df54291a4a4ade053e9f9ae` | banproof-me |
| `KV_CACHE` | KV_CACHE | `895b3586e1ce46c5b33f7a2fdbdad314` | General cache |
| `KV_SESSIONS` | KV_SESSIONS | `d0b889d0ba314b42892f5b959356ceda` | Session storage |
| `GOLDSHORE_API_KV` | GOLDSHORE-API | `9cc2209906a94851b704be57543987a9` | API layer |
| `GOLDSHORE_ORG_KV` | GOLDSHORE-ORG | `a59a5e2f446348629f59fb21ea69d795` | Legacy goldshore-org worker |
| `RMARSTON_KV` | RMARSTON-COM | `a854b3393b5c412bb945742ecb3eda1b` | rmarston-com worker |
| `GOLDSHORE_ADMIN_KV` | GOLDSHORE-ADMIN | `d02c0c7951a244a7987e23d8af16b7b2` | Admin dashboard |
| `SIGNALS_CACHE` | gs-signals-cache | `f8cc5b1dd1ec49d7a3f7bf9acc5f2b1d` | Signals worker cache |
| `SIGNALS_CACHE_PREVIEW` | gs-signals-cache-preview | `3c7b2eade8d94448a324d7a6fef2dd3d` | Signals staging |

---

## R2 Buckets

| Bucket name | Purpose |
|---|---|
| `gs-assets` | Static assets (production) |
| `gs-assets-preview` | Static assets (staging/preview) |
| `gs-telemetry-storage` | Compliance transaction logs, telemetry |
| `user-uploads` | User-uploaded content |

---

## Domain → Worker routing

| Domain | Worker / Pages | Tier | Notes |
|---|---|---|---|
| `goldshore.ai` | `gs-web-app` | 1 (public) | Canonical hostname |
| `www.goldshore.ai` | `gs-www-redirect-prod` | 1 (public) | 308 → goldshore.ai |
| `preview.goldshore.ai` | `gs-web-preview` | 1 (public) | Preview environment |
| `dashboard.goldshore.ai` | `gs-trading-prod` | 3 (admin) | Protected trading dashboard alias |
| `dash.goldshore.ai` | `gs-trading-prod` | 3 (admin) | Short protected trading dashboard alias |
| `gw.goldshore.ai` | `gs-gateway-prod` | 2 (auth) | Fail closed |
| `api.goldshore.ai` | `gs-api` | 2 (auth) | Direct API route; fail closed; /health /version /status public |
| `agent.goldshore.ai` | `gs-gateway-prod` → `gs-agent-prod` | 2 (auth) | Fail closed |
| `trading.goldshore.ai` | `gs-trading-prod` | 3 (admin) | Fail closed |
| `goldshore.ai` | `gs-web` (Pages) | 1 (public) | Canonical hostname |
| `www.goldshore.ai` | `gs-www-redirect` | 1 (public) | 308 → goldshore.ai |
| `dashboard.goldshore.ai` | `gs-gateway` | 1 (public) | 308 → admin.goldshore.ai |
| `gw.goldshore.ai` | `gs-gateway` | 2 (auth) | Fail closed |
| `api.goldshore.ai` | `gs-api` | 2 (auth) | Fail closed; /health /version /status public; route must stay on the API Worker while it validates the API Access AUD |
| `agent.goldshore.ai` | `gs-gateway` → `gs-agent` | 2 (auth) | Fail closed |
| `trading.goldshore.ai` | `gs-trading` | 3 (admin) | Fail closed |
| `ops.goldshore.ai` | `gs-control` | 3 (admin) | Fail closed |
| `admin.goldshore.ai` | `gs-admin` (Pages) | 3 (admin) | Fail closed |
| `admin.goldshore.org` | `gs-admin` (Pages) | 3 (admin) | Same app as admin.goldshore.ai |
| `goldshore.org` | `gs-web-app` | 1 (public) | Public `.org` apex serves the main Astro web app |
| `www.goldshore.org` | `gs-www-redirect-prod` | 1 (public) | 308 → goldshore.ai |
| `mail.goldshore.ai` | `gs-mail` | — | CF mail routing |
| `banproof.me` | `banproof-me` | 1 | Fail closed |
| `rmarston.com` | `rmarston-com` | 1 (public) | Fail open |
| `www.rmarston.com` | `gs-www-redirect` | 1 (public) | 308 → rmarston.com (via Worker) |
| `armsway.com` | `armsway-com-prod` | 1 (public) | Fail open |
| `www.armsway.com` | `armsway-com-prod` | 1 (public) | Fail open |
| `partnersinpools.com` | `partners-in-pools` | 1 (public) | Matteo's pool business |

---

## Access tiers

| Tier | Label | Access |
|---|---|---|
| 1 | Public | Info pages, Armsway product descriptions, rmarston.com |
| 2 | Member | Trading signals, Gearswipe stock alerts — requires Stripe subscription |
| 3 | Admin | Full D1 access, Banproof reputation management, gs-platform admin routes |

---

## Service bindings (gs-platform hub → spokes)

```toml
[[services]]
binding = "SECURITY"
service = "banproof-me"

[[services]]
binding = "SIGNALS"
service = "gs-signals-prod"

[[services]]
binding = "MAIL"
service = "gs-mail"

[[services]]
binding = "CORE"
service = "gs-core-worker"
```

```toml
# gs-admin → gs-trading (service binding — added for trading dashboard)
[[services]]
binding = "TRADING_SERVICE"
service = "gs-trading"
environment = "prod"
```

---

## Manual Setup Checkpoints

> These actions cannot be automated via code — they require you to act in the Cloudflare Dashboard or GitHub.
> Each checkpoint is a hard gate. Work in the section below it is blocked until it is done.
> When you complete one, update the `Status` column and commit this file.

---

### GATE 1 — Audit unknown workers (BLOCKS: everything below)

Two workers in your account have unknown origin. You must decide to keep or delete them before anything else.

| # | Action | Where | Status |
|---|--------|--------|--------|
| 1a | `partners-in-pools` — Matteo's pool business client site. Added to canonical table. | — | ✅ DONE |
| 1b | Same for `goldshore-ai` worker — determine if it is a stub/duplicate or actively used. Delete or document. | [CF Dashboard](https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/workers-and-pages) | ⬜ TODO |
| 1c | Same for `gs-todo` — keep or delete. | [CF Dashboard](https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/workers-and-pages) | ⬜ TODO |
| 1d | `gs-mcp` — MCP server for AI agent tooling. Added to canonical table. | — | ✅ DONE |
| 1e | `gs-web-app` — web application worker variant. Added to canonical table. | — | ✅ DONE |
| 1f | `gs-agent-prod` — prod-env deployment of gs-agent. Added to canonical table. | — | ✅ DONE |
| 1g | `gs-core-worker-prod` — prod-env deployment of gs-core-worker. Added to canonical table. | — | ✅ DONE |
| 1h | `gs-gateway-prod` — prod-env deployment of gs-gateway. Added to canonical table. | — | ✅ DONE |
| 1i | `gs-trading-prod` — prod-env deployment of gs-trading. Added to canonical table. | — | ✅ DONE |
| 1j | `gs-www-redirect-prod` — prod-env deployment of gs-www-redirect. Added to canonical table. | — | ✅ DONE |
| 1k | `armsway-com-prod` — prod-env deployment of armsway-com. Added to canonical table. | — | ✅ DONE |
| 1l | `gs-web-preview` — preview-env deployment of gs-web (`wrangler --env preview`). Added to canonical table; serves preview.goldshore.ai. | — | ✅ DONE |

---

### GATE 2 — Align `.org` apex and `www` ownership (BLOCKS: goldshore.org routing)

`apps/gs-web/wrangler.toml` owns `goldshore.org/*` through `gs-web-app`. `apps/gs-www-redirect/wrangler.toml` owns `www.goldshore.org/*` through `gs-www-redirect-prod`. The old `goldshore-org` redirect path is superseded unless live Cloudflare still shows an explicit dashboard route that needs removal.

| # | Action | Where | Status |
|---|--------|--------|--------|
| 2a | Deploy `gs-web-app` with `wrangler deploy --env prod` so `goldshore.org/*` is attached to the main web app. | GitHub Actions / CF Dashboard | ⬜ TODO |
| 2b | Deploy `gs-www-redirect-prod` with `wrangler deploy --env production` so `www.goldshore.org/*` and `www.goldshore.ai/*` are attached to the redirect Worker. | GitHub Actions / CF Dashboard | ⬜ TODO |
| 2c | Verify: `curl -I https://goldshore.org` → public web app response, not a legacy redirect worker. | Browser or curl | ⬜ TODO |
| 2d | Verify: `curl -I https://www.goldshore.org` → `308` to `https://goldshore.ai`. | Browser or curl | ⬜ TODO |
| 2e | If Cloudflare still lists a `goldshore-org` route for `goldshore.org` or `www.goldshore.org`, remove it after the two Workers above are confirmed. | CF Dashboard | ⬜ TODO |

---

### GATE 3 — Deploy gs-gateway subdomain routes (BLOCKS: dashboard, status subdomains)

Merge PR #5117. `dashboard.goldshore.ai` and `dash.goldshore.ai` are protected aliases for the trading dashboard and should be covered by the same Cloudflare Access application as `trading.goldshore.ai`. `www.goldshore.ai` is owned by `gs-www-redirect` Worker (308 redirect there). `agent.goldshore.ai/*` is owned by `gs-gateway` and forwards to `gs-agent` through the AGENT service binding; do not attach a direct custom domain to `gs-agent`. `status.goldshore.ai` is reserved for the `gs-status` Pages project (see MODULE_B2_RUNTIME_WIRING.md) — not claimed by gs-gateway.
Merge PR #5117. `dashboard.goldshore.ai` uses Worker Custom Domain (auto-provisions DNS). `www.goldshore.ai` is owned by `gs-www-redirect` Worker (308 redirect there). `agent.goldshore.ai/*` is owned by `gs-gateway` and forwards to `gs-agent` through the AGENT service binding; do not attach a direct custom domain to `gs-agent`. `status.goldshore.ai` is reserved for the `gs-status` Pages project (see MODULE_B2_RUNTIME_WIRING.md) — not claimed by gs-gateway.

| # | Action | Where | Status |
|---|--------|--------|--------|
| 3a | Merge `marzton/goldshore-ai` PR #5117 | [goldshore-ai/pull/5117](https://github.com/marzton/goldshore-ai/pull/5117) | ⬜ TODO |
| 3b | Confirm `wrangler deploy --env prod` for `gs-gateway` and `wrangler deploy --env production` for `gs-www-redirect` run (CI or manual). Custom domains will auto-create DNS where configured. | CF Dashboard | ⬜ TODO |
| 3c | Verify: `curl -I https://www.goldshore.ai` → `308` to `https://goldshore.ai` (handled by gs-www-redirect) | Browser or curl | ⬜ TODO |
| 3d | Verify: `curl -I https://dashboard.goldshore.ai` reaches the `GoldShore-Trading-ZT` Access wall, or returns 200 when valid CF Access service-token headers are supplied | Browser or curl | ⬜ TODO |

---

### GATE 4 — CF Access identity providers (BLOCKS: SSO on any subdomain)

Configure the identity providers required by the canonical Cloudflare Access IdP matrix in `docs/domains-and-auth.md`; that table is the only per-app IdP source of truth.

| # | Action | Where | Status |
|---|--------|--------|--------|
| 4a | Go to CF Zero Trust → Settings → Authentication and configure Google Workspace and email OTP as required by the canonical matrix in `docs/domains-and-auth.md`. Requires a Google OAuth client ID + secret for Workspace. | [CF Zero Trust](https://one.dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/settings/authentication) | ⬜ TODO |
| 4b | Add both GitHub providers named in the canonical matrix: GitHub GoldShore Deploy and generic GitHub. Each requires a GitHub OAuth App (create at github.com/settings/developers). Callback URL = `https://goldshore.cloudflareaccess.com/cdn-cgi/access/callback`. | [CF Zero Trust](https://one.dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/settings/authentication) | ⬜ TODO |
| 4c | Test both logins — CF will show a "Test" button next to each provider after saving. | CF Zero Trust UI | ⬜ TODO |

---

### GATE 5 — CF Access applications (BLOCKS: protected subdomains accepting logins)

Create one Access application per protected subdomain group. All require Gate 4 to be complete.

**Important:** Keep Access audience tags aligned with the Worker that validates them. `api.goldshore.ai` is validated by `gs-api` with its API Access AUD, so it must stay on the API Access application unless the downstream Worker secret/config changes at the same time. `gw.goldshore.ai` and `agent.goldshore.ai` share the gateway Access application/AUD. Public probes (`/health`, `/status`) must be excluded via a bypass policy so monitoring scripts do not hit the login wall. Configure allowed login methods or OR policies from the canonical Cloudflare Access IdP matrix in `docs/domains-and-auth.md`; do not encode alternative IdPs as multiple conjunctive Require selectors.
**Important:** `api.goldshore.ai` is owned directly by the `gs-api` Worker route, while `agent.goldshore.ai` routes through the `gs-gateway` Worker. Configure Cloudflare Access audiences per owning Worker, and exclude public probes (`/health`, `/status`) via bypass policy so monitoring scripts do not hit the login wall.
**Important:** `api.goldshore.ai` and `agent.goldshore.ai` both route to the same `gs-gateway` Worker, which holds a single `CLOUDFLARE_ACCESS_AUDIENCE` binding. They **must share one Access application** so the same AUD tag validates tokens from either subdomain. Public probes (`/health`, `/status`) must be excluded via a bypass policy so monitoring scripts do not hit the login wall. Set all policy **Require** rules from the canonical Cloudflare Access IdP matrix in `docs/domains-and-auth.md`.

| # | Subdomain(s) | Application name | Policy | Where | Status |
|---|---|---|---|---|---|
| 5a | `admin.goldshore.ai`, `admin-preview.goldshore.ai`, `admin.goldshore.org` | Goldshore Admin | Identity-based allow policy (not `non_identity` / `everyone`): Email domains `@goldshore.ai`, `@marzton.dev`; Specific email = marstonr6@gmail.com (allow) | [CF Access Apps](https://one.dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/access/apps) | ⬜ TODO |
| 5b | `trading.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai` | Goldshore Trading | Email = marstonr6@gmail.com (allow). Add **bypass policy** for `/oauth/schwab/callback` and `/oauth/robinhood/callback` (everyone) — Schwab/Robinhood redirect to these paths without an Access session. | CF Access Apps | ⬜ TODO |
| 5c | `ops.goldshore.ai` | Goldshore Ops | Email = marstonr6@gmail.com (allow) | CF Access Apps | ⬜ TODO |
| 5d | `gw.goldshore.ai` + `agent.goldshore.ai` | Goldshore Gateway | These hosts share the gateway Access app and gateway AUD tag. Email = marstonr6@gmail.com (allow). Add **bypass policy** for paths `/health`, `/status`, and `/version` (everyone). | CF Access Apps | ⬜ TODO |
| 5e | `api.goldshore.ai` | Goldshore API | Preserve the API Access app and AUD tag expected by `gs-api` (`d303765cb1746f11a0fe37affad2d191deb18771a1d98beb29cb9c52b6cd731b`). Email = marstonr6@gmail.com (allow). Add **bypass policy** for paths `/`, `/health`, `/status`, and `/version` (everyone). | CF Access Apps | ⬜ TODO |
| 5f | Copy the **Audience (AUD) tag** for each app and store it as GitHub Actions secrets (`CLOUDFLARE_ACCESS_AUDIENCE_ADMIN`, `CLOUDFLARE_ACCESS_AUDIENCE_TRADING`, `CLOUDFLARE_ACCESS_AUDIENCE_GATEWAY`, `CLOUDFLARE_ACCESS_AUDIENCE_API`) and as wrangler secrets in each Worker. | CF Access App → Overview tab | ⬜ TODO |
| 5d | `gw.goldshore.ai` + `agent.goldshore.ai`; `api.goldshore.ai` separately | Goldshore Gateway / Goldshore API | `gw` and `agent` route to `gs-gateway`; `api` routes directly to `gs-api`. Use separate Access audiences if protected. Email = marstonr6@gmail.com (allow). Add **bypass policy** for paths `/health`, `/status`, and `/version` (everyone). | CF Access Apps | ⬜ TODO |
| 5e | Copy the **Audience (AUD) tag** for each app and store it as a GitHub Actions secret (`CLOUDFLARE_ACCESS_AUDIENCE_ADMIN`, `CLOUDFLARE_ACCESS_AUDIENCE_TRADING`, `CLOUDFLARE_ACCESS_AUDIENCE_GATEWAY`) and as wrangler secrets in each Worker. | CF Access App → Overview tab | ⬜ TODO |

---

### GATE 6 — gs-admin Pages custom domain for .org (BLOCKS: admin.goldshore.org)

| # | Action | Where | Status |
|---|--------|--------|--------|
| 6a | Go to CF Dashboard → Pages → `gs-admin` → Custom Domains → Add `admin.goldshore.org` (`infra/Cloudflare/desired-state.yaml` already documents this) | [CF Pages gs-admin](https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/pages/view/gs-admin) | ⬜ TODO |
| 6b | Verify DNS: CF should auto-create a CNAME for `admin.goldshore.org` → `gs-admin.pages.dev` in the goldshore.org zone | CF DNS → goldshore.org zone | ⬜ TODO |
| 6c | After Gate 5a — verify login wall appears at `https://admin.goldshore.org` | Browser | ⬜ TODO |

---

### GATE 7 — End-to-end smoke test (BLOCKS: trading dashboard work)

All gates above must be ✅ before trading dashboard Phase 1 begins.

| # | Check | Expected result | Status |
|---|-------|-----------------|--------|
| 7a | `https://goldshore.ai` | Public homepage loads | ⬜ TODO |
| 7b | `https://goldshore.org` | Public homepage loads from `gs-web-app` | ⬜ TODO |
| 7c | `https://www.goldshore.ai` | 308 → goldshore.ai | ⬜ TODO |
| 7d | `https://www.goldshore.org` | 308 → goldshore.ai | ⬜ TODO |
| 7e | `https://admin.goldshore.ai` | CF Access login wall | ⬜ TODO |
| 7f | `https://admin.goldshore.org` | CF Access login wall | ⬜ TODO |
| 7g | `https://trading.goldshore.ai` | CF Access login wall | ⬜ TODO |
| 7h | `https://gw.goldshore.ai/status` | JSON binding health response (status.goldshore.ai reserved for gs-status Pages — not yet built) | ⬜ TODO |
| 7i | Contact form → email delivered to marstonr6@gmail.com | End-to-end mail test | ⬜ TODO |
| 7j | Update `Last certified` date at top of this file and commit after live verification is complete. | This file | ⬜ TODO |

---

## Schema migration protocol

- All schema changes go in `infra/migrations/<db>/<version>_<description>.sql`
- Versions are zero-padded 3-digit integers: `001`, `002`, `003`...
- Every migration must INSERT into `schema_migrations` table
- Migrations are applied via CI — never manually via dashboard
- Rollback = new forward migration only (no destructive rollbacks in production)
