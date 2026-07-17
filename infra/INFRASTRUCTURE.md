# Gold Shore Labs — Infrastructure Inventory and Target Architecture

> **This file is the source of truth. No AI agent, no PR, no human may change
> Cloudflare resources without a corresponding change to this file passing CI.**
>
> Last certified: 2026-04-29 | Certified by: Rob Marston (@marzton)
> Repo alignment pass: 2026-06-30 | `goldshore.org` apex ownership moved to `gs-web-prod`; `www.goldshore.org` ownership moved to `gs-www-redirect-prod`.
> Redirect cleanup pass: 2026-07-11 | `gs-www-redirect-prod` is the sole canonical www redirect Worker for `www.goldshore.ai/*` and `www.goldshore.org/*`; the stale alternate production deployment is no longer part of the canonical set.
> Live audit reconciliation pass: 2026-07-15 | Recorded observed `gs-api-prod`, `gs-api-staging`, and legacy `gs-agent-preview` workers so live-state audit reflects Cloudflare reality without expanding the in-repo app set.

---

## Account

| Key | Value |
|---|---|
| Account ID | `f77de112d2019e5456a3198a8bb50bd2` |
| Subdomain | `goldshore.workers.dev` |
| Account name | Gold Shore Labs |

---

## Current live Cloudflare worker inventory (observed — not all canonical)

This section records the **current live Cloudflare inventory** so audit tooling and operators can reconcile what exists in the Cloudflare account. It is intentionally broader than the target in-repo architecture. A worker appearing here does **not** make it canonical for this repository.

| Worker name | Current purpose / observed role | Domains served | Repository disposition | Cloudflare disposition | Fail policy |
|---|---|---|---|---|---|
| `gs-api` | Unified API layer | `api.goldshore.ai` | **Canonical in-repo app:** keep in `apps/gs-api` | Keep | Fail closed |
| `gs-api-preview` | Preview environment for `gs-api` | — | **Canonical in-repo preview:** keep tied to `apps/gs-api` | Keep while preview is needed | Fail closed |
| `gs-api-prod` | Production deployment of `gs-api` | `api.goldshore.ai` | **Canonical production deploy:** deploy from `apps/gs-api` | Keep | Fail closed |
| `gs-api-staging` | Staging deployment of `gs-api` | — | **Canonical staging deploy:** keep tied to `apps/gs-api` | Keep while staging is needed | Fail closed |
| `gs-web` | Goldshore web frontend static assets / non-prod deployment | — | **Canonical in-repo app:** keep in `apps/gs-web` | Keep only if still used for non-prod/static deployment | Fail open (public) |
| `gs-web-preview` | Preview environment for `gs-web` | `preview.goldshore.ai` | **Canonical in-repo preview:** keep tied to `apps/gs-web` | Keep while preview is needed | Fail open |
| `gs-web-staging` | Staging variant of `gs-web` | `staging.goldshore.ai` | **Canonical in-repo staging:** keep tied to `apps/gs-web` | Keep while staging is needed | Fail open |
| `gs-web-prod` | Main public web application worker for `goldshore.ai` and `goldshore.org` apex | `goldshore.ai`, `goldshore.org` | **Canonical production deploy:** deploy from `apps/gs-web` | Keep | Fail open (public) |
| `gs-agent` | Legacy AI agent worker | — | **Legacy non-canonical:** migrate AI routes/logic into `apps/gs-api` queues/routes | Delete from Cloudflare after traffic and service-binding verification | Fail closed |
| `gs-agent-preview` | Preview deployment of legacy `gs-agent` | — | **Legacy non-canonical:** do not target from this repo; migrate any still-needed preview behavior into `apps/gs-api` | Delete from Cloudflare after traffic and service-binding verification | Fail closed |
| `gs-agent-prod` | Production-env deployment of legacy `gs-agent` | — | **Legacy non-canonical:** migrate AI routes/logic into `apps/gs-api` queues/routes | Delete from Cloudflare after traffic and service-binding verification | Fail closed |
| `gs-mail` | Legacy transactional mail dispatch | `mail.goldshore.ai` / CF mail routing | **Legacy non-canonical:** migrate mail routes, dispatch, and email handlers into `apps/gs-api` | Delete from Cloudflare after mail traffic verification | Fail closed |
| `gs-control` | Legacy build control / ops service | `ops.goldshore.ai` | **Legacy non-canonical:** migrate API/ops endpoints into `apps/gs-api`; migrate any UI into `apps/gs-web` `/admin` or `/ops` routes | Delete from Cloudflare after ops traffic verification; keep only the Cloudflare build token name as an external credential reference | Fail closed |
| `gs-gateway` | Legacy gateway placeholder / deployed from old gateway flow | `gw.goldshore.ai`, `agent.goldshore.ai` | **Legacy non-canonical:** migrate auth/proxy/routing behavior into `apps/gs-api` | Delete from Cloudflare after gateway and agent traffic verification | Fail closed |
| `gs-gateway-prod` | Production-env deployment of legacy `gs-gateway` | `gw.goldshore.ai`, `agent.goldshore.ai` | **Legacy non-canonical:** migrate auth/proxy/routing behavior into `apps/gs-api` | Delete from Cloudflare after gateway and agent traffic verification | Fail closed |
| `gs-platform` | Legacy platform hub / internal service-binding traffic | — | **Legacy non-canonical:** migrate platform routes, D1 access, registry/audit logic into `apps/gs-api`; migrate platform/admin UI into `apps/gs-web` | Delete from Cloudflare after service-binding and route verification | Fail closed on auth routes |
| `gs-trading` | Legacy Schwab + Robinhood brokerage integration, trading API, risk engine | — | **Legacy non-canonical:** migrate brokerage APIs, OAuth callbacks, risk engine, queues/crons into `apps/gs-api`; migrate dashboards into `apps/gs-web` | Delete from Cloudflare after trading/dashboard traffic verification | Fail closed |
| `gs-trading-prod` | Production-env deployment of legacy `gs-trading` | `trading.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai` | **Legacy non-canonical:** migrate backend to `apps/gs-api` and UI to `apps/gs-web` | Delete from Cloudflare after trading/dashboard traffic verification | Fail closed |
| `gs-core-worker` | Gearswipe/StellarAIO ATC trigger and signals consumer | — | **Legacy non-canonical:** migrate queue consumers, cron jobs, and signal ingestion into `apps/gs-api` | Delete from Cloudflare after queue/consumer traffic verification | Fail closed |
| `gs-core-worker-prod` | Production-env deployment of legacy `gs-core-worker` | — | **Legacy non-canonical:** migrate queue consumers, cron jobs, and signal ingestion into `apps/gs-api` | Delete from Cloudflare after queue/consumer traffic verification | Fail closed |
| `gs-admin` | Legacy admin dashboard worker / Pages app | `admin.goldshore.ai`, `admin.goldshore.org` | **Legacy non-canonical:** migrate UI into `apps/gs-web` admin sub-routes and admin APIs into `apps/gs-api` | Delete from Cloudflare after admin traffic verification | Fail closed |
| `gs-signals-prod` | Polygon sentiment analysis and signal generation | — | **Legacy non-canonical unless owned externally:** migrate signal APIs, crons, and queues into `apps/gs-api` | Delete from Cloudflare after signal traffic verification unless explicitly retained as external | Fail closed |
| `gs-mcp` | MCP server for AI agent tooling | — | **External to this repo unless later folded into `apps/gs-api`** | Keep external to this repo | Fail closed |
| `goldclaw` | Goldclaw auth/monetization integration worker | — | **External to this repo unless later folded into `apps/gs-api`** | Keep external to this repo | Fail closed |
| `banproof-me` | Proof-of-Agency security layer, contact forms, PoA workflow | `banproof.me` | **External/client app:** keep external to this repo unless product scope changes | Keep external to this repo | Fail closed |
| `banproof-email-router` | Banproof email routing | — | **External/client app:** keep external to this repo | Keep external to this repo | Fail closed |
| `banproof` | BanProof legacy worker | — | **External legacy:** audit; keep external only if still serving BanProof traffic | Delete after BanProof traffic verification if unused | Fail closed |
| `armsway-com` | Armsway site worker | `armsway.com` | **External/client app:** keep external to this repo | Keep external to this repo | Fail open (public) |
| `armsway-com-prod` | Production-env deployment of Armsway site worker | `armsway.com`, `www.armsway.com` | **External/client app:** keep external to this repo | Keep external to this repo | Fail open (public) |
| `partners-in-pools` | Matteo's pool business client site | `partnersinpools.com` | **External/client app:** keep external to this repo | Keep external to this repo | Fail open (public) |
| `rmarston-com` | rmarston.com personal site | `rmarston.com` | **External/personal app:** keep external to this repo | Keep external to this repo | Fail open (public) |
| `gs-www-redirect` | Legacy standalone www redirect worker | `www.goldshore.ai`, `www.goldshore.org`, `www.rmarston.com` | **Non-canonical for this repo:** migrate Goldshore redirects into `apps/gs-web` or `apps/gs-api`; keep non-Goldshore redirects external if needed | Delete from Cloudflare after redirect traffic verification, or keep external for non-Goldshore domains | Fail open |
| `gs-www-redirect-prod` | Production-env deployment of standalone www redirect worker | `www.goldshore.ai`, `www.goldshore.org` | **Temporary live redirect:** migrate Goldshore redirects into canonical app routing | Delete from Cloudflare after redirect traffic verification | Fail open |
| `gs-www-redirect-production` | Stale alternate production deployment of `gs-www-redirect` created without a `name` override | — | **Duplicate / non-canonical** | Delete from Cloudflare after `gs-www-redirect-prod` is confirmed handling all www traffic | Fail open |
| `goldshore-org` | Legacy `goldshore.org` redirect worker, superseded by `gs-web-prod` + `gs-www-redirect-prod` | — | **Legacy non-canonical:** no in-repo app should target this | Delete from Cloudflare after `.org` route verification | Fail open (public) |
| `goldshore-ai` | Audit pending — may be stub/duplicate | — | **Unknown / non-canonical:** do not treat as in-repo architecture | Delete from Cloudflare after traffic verification unless proven external | TBD |
| `gs-todo` | Audit pending — may be internal tool | — | **Unknown / non-canonical:** migrate useful UI into `apps/gs-web` and APIs into `apps/gs-api`, or keep external if not a Goldshore app | Delete from Cloudflare after traffic verification unless explicitly kept external | TBD |

**Inventory rule:** Workers not listed above must not exist without updating this live inventory.

**Architecture rule:** Only `apps/gs-web` and `apps/gs-api` are canonical deploy targets for this repository. Legacy workers in this table are inventory records and migration work items, not approved in-repo architecture.

---

## Legacy workers pending migration or deletion

The following live workers are specifically **non-canonical** for this repository and must not be described as the target in-repo architecture. Their functionality should be migrated, externalized, or deleted as indicated.

| Legacy worker(s) | Migration disposition | Verification before deletion |
|---|---|---|
| `gs-agent`, `gs-agent-prod` | Migrate into `apps/gs-api` (AI routes, agent orchestration, queue handlers). | Confirm no direct routes, service bindings, queue consumers, or Access apps still target the legacy worker. |
| `gs-mail` | Migrate into `apps/gs-api` (mail dispatch, inbound email handlers, templates/API endpoints). | Confirm CF Email Routing, service bindings, and transactional sends use `gs-api`. |
| `gs-control` | Migrate APIs into `apps/gs-api`; migrate UI into `apps/gs-web`; keep the `gs-control` build token as an external credential reference only. | Confirm `ops.goldshore.ai` and build-control calls no longer hit the worker. |
| `gs-gateway`, `gs-gateway-prod` | Migrate into `apps/gs-api` (gateway, auth, proxy, `/health`, `/status`, `/version`, and agent forwarding). | Confirm `gw.goldshore.ai` and `agent.goldshore.ai` route to `gs-api` and Access AUD validation still works. |
| `gs-platform` | Migrate into `apps/gs-api`; migrate any platform/admin UI into `apps/gs-web`. | Confirm service bindings and D1/KV operations have moved to canonical apps. |
| `gs-trading`, `gs-trading-prod` | Migrate trading APIs, OAuth callbacks, risk engine, queues, and crons into `apps/gs-api`; migrate trading dashboards into `apps/gs-web`. | Confirm `trading.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai`, OAuth callbacks, and broker webhooks use canonical apps. |
| `gs-core-worker`, `gs-core-worker-prod` | Migrate into `apps/gs-api` (queue consumers, cron jobs, ATC triggers, signal ingestion). | Confirm queues, scheduled jobs, and signal producers no longer target the legacy worker. |
| `gs-admin` | Migrate UI into `apps/gs-web`; migrate admin APIs into `apps/gs-api`. | Confirm `admin.goldshore.ai` and `admin.goldshore.org` are served by canonical app routes. |
| `gs-signals-prod` | Migrate into `apps/gs-api` unless intentionally kept external to this repo. | Confirm signal generation, subscriptions, and cache writes have moved or are explicitly external. |
| `gs-www-redirect`, `gs-www-redirect-prod`, `gs-www-redirect-production`, `goldshore-org` | Migrate Goldshore redirects into canonical app routing; delete stale duplicates. | Confirm `www.goldshore.ai`, `www.goldshore.org`, and `goldshore.org` traffic resolves to canonical apps/redirects. |
| `goldshore-ai`, `gs-todo`, `banproof` | Audit first; migrate into canonical apps, keep external, or delete after traffic verification. | Confirm Cloudflare analytics/routes show no required traffic before deletion. |

---

## Target in-repo deploy architecture

This repository's target architecture is a strict two-app monorepo:

| Canonical app | Role | Owns | Must not be split into |
|---|---|---|---|
| `apps/gs-web` | Astro frontend | Public pages, admin/trading/platform UI sub-routes, documentation pages, client-side logic, redirects that can be handled at the frontend edge. | `gs-admin`, `gs-platform`, `gs-trading`, separate docs/admin frontends, standalone Goldshore redirect apps. |
| `apps/gs-api` | Unified Cloudflare Worker API | API routes, auth middleware, proxy/gateway behavior, AI/agent routes, mail handlers, cron jobs, queue consumers, D1/KV/R2 operations, trading/brokerage integrations, service-binding replacements. | `gs-agent`, `gs-mail`, `gs-control`, `gs-gateway`, `gs-platform`, `gs-trading`, `gs-core-worker`, new satellite Workers. |

All new Goldshore backend work must enter through `apps/gs-api`. All new Goldshore UI work must enter through `apps/gs-web`. Do not add new Workers under `apps/` and do not add new production deploy workflow files beyond the canonical `gs-web` and `gs-api` deployments.

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

## Current domain → Cloudflare target routing

This table records **live or recently observed routing**. Rows marked legacy/non-canonical are migration inputs; they are not target architecture for this repository.

| Domain | Current Worker / Pages target | Tier | Architecture status | Notes |
|---|---|---|---|---|
| `goldshore.ai` | `gs-web-prod` | 1 (public) | Canonical target: `apps/gs-web` | Canonical hostname. |
| `www.goldshore.ai` | `gs-www-redirect-prod` | 1 (public) | Temporary legacy redirect | Target is canonical app routing; 308 → `https://goldshore.ai`. |
| `preview.goldshore.ai` | `gs-web-preview` | 1 (public) | Canonical preview: `apps/gs-web` | Preview environment. |
| `staging.goldshore.ai` | `gs-web-staging` | 1 (public) | Canonical staging: `apps/gs-web` | Staging environment if still needed. |
| `goldshore.org` | `gs-web-prod` | 1 (public) | Canonical target: `apps/gs-web` | Public `.org` apex serves the main Astro web app. |
| `www.goldshore.org` | `gs-www-redirect-prod` | 1 (public) | Temporary legacy redirect | Target is canonical app routing; 308 → `https://goldshore.ai`. |
| `api.goldshore.ai` | `gs-api` | 2 (auth) | Canonical target: `apps/gs-api` | Direct API route; fail closed; `/health`, `/version`, `/status` public. |
| `gw.goldshore.ai` | `gs-gateway-prod` | 2 (auth) | Legacy pending migration to `apps/gs-api` | Gateway/proxy behavior should move to `gs-api`. |
| `agent.goldshore.ai` | `gs-gateway-prod` → `gs-agent-prod` | 2 (auth) | Legacy pending migration to `apps/gs-api` | Agent routing and AI orchestration should move to `gs-api`. |
| `trading.goldshore.ai` | `gs-trading-prod` | 3 (admin) | Legacy pending migration to `apps/gs-api` + `apps/gs-web` | Backend to `gs-api`; dashboard UI to `gs-web`. |
| `dashboard.goldshore.ai` | `gs-trading-prod` | 3 (admin) | Legacy pending migration to `apps/gs-api` + `apps/gs-web` | Protected trading dashboard alias. |
| `dash.goldshore.ai` | `gs-trading-prod` | 3 (admin) | Legacy pending migration to `apps/gs-api` + `apps/gs-web` | Short protected trading dashboard alias. |
| `ops.goldshore.ai` | `gs-control` | 3 (admin) | Legacy pending migration to `apps/gs-api` + `apps/gs-web` | Ops APIs to `gs-api`; UI to `gs-web`; keep build token external only. |
| `admin.goldshore.ai` | `gs-admin` (Pages) | 3 (admin) | Legacy pending migration to `apps/gs-web` + `apps/gs-api` | Admin UI should become `gs-web` sub-routes. |
| `admin.goldshore.org` | `gs-admin` (Pages) | 3 (admin) | Legacy pending migration to `apps/gs-web` + `apps/gs-api` | Same migration as `admin.goldshore.ai`. |
| `mail.goldshore.ai` | `gs-mail` | — | Legacy pending migration to `apps/gs-api` | CF mail routing and dispatch should move to `gs-api`. |
| `banproof.me` | `banproof-me` | 1 | External to this repo | Fail closed; keep external unless product scope changes. |
| `rmarston.com` | `rmarston-com` | 1 (public) | External to this repo | Fail open. |
| `www.rmarston.com` | `gs-www-redirect` | 1 (public) | External/legacy redirect | Keep external if still required for non-Goldshore routing. |
| `armsway.com` | `armsway-com-prod` | 1 (public) | External to this repo | Fail open. |
| `www.armsway.com` | `armsway-com-prod` | 1 (public) | External to this repo | Fail open. |
| `partnersinpools.com` | `partners-in-pools` | 1 (public) | External to this repo | Matteo's pool business. |


## Access tiers

| Tier | Label | Access |
|---|---|---|
| 1 | Public | Info pages, Armsway product descriptions, rmarston.com |
| 2 | Member | Trading signals, Gearswipe stock alerts — requires Stripe subscription |
| 3 | Admin | Full D1 access, Banproof reputation management, and admin routes now targeted for `apps/gs-api` / `apps/gs-web` |

---

## Current legacy service bindings to unwind

These bindings document legacy live coupling. They are not the target architecture. As migrations complete, replace spoke Worker calls with internal modules, queues, or routes inside `apps/gs-api`, and remove the legacy Worker/service binding from Cloudflare.

```toml
# Legacy gs-platform hub → spokes; migrate these responsibilities into apps/gs-api.
[[services]]
binding = "SECURITY"
service = "banproof-me" # keep external unless BanProof scope moves into this repo

[[services]]
binding = "SIGNALS"
service = "gs-signals-prod" # migrate to apps/gs-api or explicitly keep external

[[services]]
binding = "MAIL"
service = "gs-mail" # migrate to apps/gs-api

[[services]]
binding = "CORE"
service = "gs-core-worker" # migrate to apps/gs-api
```

```toml
# Legacy gs-admin → gs-trading; migrate UI to apps/gs-web and backend to apps/gs-api.
[[services]]
binding = "TRADING_SERVICE"
service = "gs-trading"
environment = "prod"
```


## Manual Setup Checkpoints

> These actions cannot be automated via code — they require you to act in the Cloudflare Dashboard or GitHub.
> Each checkpoint is a hard gate. Work in the section below it is blocked until it is done.
> When you complete one, update the `Status` column and commit this file.

---

### GATE 1 — Audit unknown workers (BLOCKS: everything below)

Two workers in your account have unknown origin. You must decide to keep or delete them before anything else.

| # | Action | Where | Status |
|---|--------|--------|--------|
| 1a | `partners-in-pools` — Matteo's pool business client site. Recorded in live inventory. | — | ✅ DONE |
| 1b | Same for `goldshore-ai` worker — determine if it is a stub/duplicate or actively used. Delete or document. | [CF Dashboard](https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/workers-and-pages) | ⬜ TODO |
| 1c | Same for `gs-todo` — keep or delete. | [CF Dashboard](https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/workers-and-pages) | ⬜ TODO |
| 1d | `gs-mcp` — MCP server for AI agent tooling. Recorded in live inventory. | — | ✅ DONE |
| 1e | `gs-web-prod` — web application worker variant. Recorded in live inventory. | — | ✅ DONE |
| 1f | `gs-agent-prod` — prod-env deployment of gs-agent. Recorded in live inventory. | — | ✅ DONE |
| 1g | `gs-core-worker-prod` — prod-env deployment of gs-core-worker. Recorded in live inventory. | — | ✅ DONE |
| 1h | `gs-gateway-prod` — prod-env deployment of gs-gateway. Recorded in live inventory. | — | ✅ DONE |
| 1i | `gs-trading-prod` — prod-env deployment of gs-trading. Recorded in live inventory. | — | ✅ DONE |
| 1j | `gs-www-redirect-prod` — prod-env deployment of gs-www-redirect. Recorded in live inventory. | — | ✅ DONE |
| 1k | `armsway-com-prod` — prod-env deployment of armsway-com. Recorded in live inventory. | — | ✅ DONE |
| 1l | `gs-web-preview` — preview-env deployment of gs-web (`wrangler --env preview`). Recorded in live inventory; serves preview.goldshore.ai. | — | ✅ DONE |
| 1m | `goldclaw` — goldclaw auth/monetization integration worker. Recorded in live inventory. | — | ✅ DONE |
| 1n | `gs-www-redirect-production` — stale alternate production deployment of gs-www-redirect created by `wrangler --env production` without a `name` override; duplicate of `gs-www-redirect-prod`. Recorded in live inventory. Delete from CF dashboard once `gs-www-redirect-prod` is confirmed handling all www traffic. | [CF Dashboard](https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/workers-and-pages) | ⬜ TODO (delete from CF) |

---

### GATE 2 — Align `.org` apex and `www` ownership (BLOCKS: goldshore.org routing)

`apps/gs-web/wrangler.toml` owns `goldshore.org/*` through `gs-web-prod`. `apps/gs-www-redirect/wrangler.toml` owns `www.goldshore.org/*` and `www.goldshore.ai/*` through `gs-www-redirect-prod` (note: this app's environment is named `production`, not `prod` — `wrangler deploy --env production` is correct for it specifically, unlike `gs-api`/`gs-web`). The old `goldshore-org` redirect path is superseded unless live Cloudflare still shows an explicit dashboard route that needs removal.

| # | Action | Where | Status |
|---|--------|--------|--------|
| 2a | Deploy `gs-web-prod` with `wrangler deploy --env prod` so `goldshore.org/*` is attached to the main web app. | GitHub Actions / CF Dashboard | ⬜ TODO |
| 2b | Deploy `gs-www-redirect-prod` with `wrangler deploy --env production` so `www.goldshore.org/*` and `www.goldshore.ai/*` stay attached to the redirect Worker until canonical redirect routing is verified in `apps/gs-web` or `apps/gs-api`. | GitHub Actions / CF Dashboard | ⬜ TODO |
| 2c | Verify: `curl -I https://goldshore.org` → public web app response, not a legacy redirect worker. | Browser or curl | ⬜ TODO |
| 2d | Verify: `curl -I https://www.goldshore.org` → `308` to `https://goldshore.ai`. | Browser or curl | ⬜ TODO |
| 2e | If Cloudflare still lists a `goldshore-org` route for `goldshore.org` or `www.goldshore.org`, remove it after the two Workers above are confirmed. | CF Dashboard | ⬜ TODO |

---

### GATE 3 — Migrate gateway and trading subdomain routes (BLOCKS: dashboard, status subdomains)

`dashboard.goldshore.ai` and `dash.goldshore.ai` are protected aliases for the trading dashboard and should be covered by the same Cloudflare Access application as `trading.goldshore.ai`. `gs-gateway`, `gs-agent`, and `gs-trading` are legacy live workers; migrate gateway/agent/trading backend behavior into `apps/gs-api` and dashboard UI into `apps/gs-web` before deleting the legacy workers. `status.goldshore.ai` is reserved for the `gs-status` Pages project (see MODULE_B2_RUNTIME_WIRING.md) and is not a reason to keep `gs-gateway` canonical.

| # | Action | Where | Status |
|---|--------|--------|--------|
| 3a | Audit PR #5117 only for migration context; do not treat `gs-gateway` or `gs-agent` as canonical in-repo deploy targets. | [goldshore-ai/pull/5117](https://github.com/marzton/goldshore-ai/pull/5117) | ⬜ TODO |
| 3b | Confirm replacement routing through `apps/gs-api` / `apps/gs-web`; keep legacy `gs-gateway` and `gs-www-redirect` deployments only until traffic verification is complete. | CF Dashboard | ⬜ TODO |
| 3c | Verify: `curl -I https://www.goldshore.ai` → `308` to `https://goldshore.ai` (handled by gs-www-redirect) | Browser or curl | ⬜ TODO |
| 3d | Verify: `curl -I https://dashboard.goldshore.ai` reaches the `GoldShore-Trading-ZT` Access wall, or returns 200 when valid CF Access service-token headers are supplied, with target routing planned for `apps/gs-web` + `apps/gs-api` | Browser or curl | ⬜ TODO |
Merge PR #5117. `dashboard.goldshore.ai` and `dash.goldshore.ai` are protected aliases for the trading dashboard and should be covered by the same Cloudflare Access application as `trading.goldshore.ai`. `www.goldshore.ai` is owned by `gs-www-redirect` Worker (308 redirect there). `agent.goldshore.ai/*` is owned by `gs-gateway` and forwards to `gs-agent` through the AGENT service binding; do not attach a direct custom domain to `gs-agent`. `status.goldshore.ai` is reserved for the `gs-status` Pages project (see MODULE_B2_RUNTIME_WIRING.md) — not claimed by gs-gateway.

| # | Action | Where | Status |
|---|--------|--------|--------|
| 3a | Audit PR #5117 only for migration context; do not treat `gs-gateway` or `gs-agent` as canonical in-repo deploy targets. | [goldshore-ai/pull/5117](https://github.com/marzton/goldshore-ai/pull/5117) | ⬜ TODO |
| 3b | Confirm replacement routing through `apps/gs-api` / `apps/gs-web`; keep legacy `gs-gateway` and `gs-www-redirect` deployments only until traffic verification is complete. | CF Dashboard | ⬜ TODO |
| 3c | Verify: `curl -I https://www.goldshore.ai` → `308` to `https://goldshore.ai` (handled by gs-www-redirect) | Browser or curl | ⬜ TODO |
| 3d | Verify: `curl -I https://dashboard.goldshore.ai` reaches the `GoldShore-Trading-ZT` Access wall, or returns 200 when valid CF Access service-token headers are supplied, with target routing planned for `apps/gs-web` + `apps/gs-api` | Browser or curl | ⬜ TODO |

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

Create one Access application per protected subdomain group. All require Gate 4 to be complete. Keep Access audience tags aligned with the Worker that validates them during migration: `api.goldshore.ai` is already validated by canonical `gs-api`, while `gw.goldshore.ai`, `agent.goldshore.ai`, `trading.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai`, `ops.goldshore.ai`, and admin hosts may still be protected in front of legacy workers until their traffic is cut over to `apps/gs-api` / `apps/gs-web`. Public probes (`/health`, `/status`, `/version`) must be excluded via bypass policies so monitoring scripts do not hit the login wall. Configure allowed login methods or OR policies from the canonical Cloudflare Access IdP matrix in `docs/domains-and-auth.md`; do not encode alternative IdPs as multiple conjunctive Require selectors.

| # | Subdomain(s) | Application name | Policy | Where | Status |
|---|---|---|---|---|---|
| 5a | `admin.goldshore.ai`, `admin-preview.goldshore.ai`, `admin.goldshore.org` | Goldshore Admin | Identity-based allow policy (not `non_identity` / `everyone`): Email domains `@goldshore.ai`, `@marzton.dev`; Specific email = marstonr6@gmail.com (allow). Target implementation belongs in `apps/gs-web` + `apps/gs-api`; legacy `gs-admin` is temporary. | [CF Access Apps](https://one.dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/access/apps) | ⬜ TODO |
| 5b | `trading.goldshore.ai`, `dashboard.goldshore.ai`, `dash.goldshore.ai` | Goldshore Trading | Email = marstonr6@gmail.com (allow). Add **bypass policy** for `/oauth/schwab/callback` and `/oauth/robinhood/callback` (everyone). Target implementation belongs in `apps/gs-web` + `apps/gs-api`; legacy `gs-trading` is temporary. | CF Access Apps | ⬜ TODO |
| 5c | `ops.goldshore.ai` | Goldshore Ops | Email = marstonr6@gmail.com (allow). Target implementation belongs in `apps/gs-web` + `apps/gs-api`; legacy `gs-control` is temporary. | CF Access Apps | ⬜ TODO |
| 5d | `gw.goldshore.ai` + `agent.goldshore.ai` | Goldshore Gateway | Legacy gateway Access app until migration; target validation belongs in `apps/gs-api`. Email = marstonr6@gmail.com (allow). Add **bypass policy** for paths `/health`, `/status`, and `/version` (everyone). | CF Access Apps | ⬜ TODO |
| 5e | `api.goldshore.ai` | Goldshore API | Preserve the API Access app and AUD tag expected by canonical `gs-api` (`d303765cb1746f11a0fe37affad2d191deb18771a1d98beb29cb9c52b6cd731b`). Email = marstonr6@gmail.com (allow). Add **bypass policy** for paths `/`, `/health`, `/status`, and `/version` (everyone). | CF Access Apps | ⬜ TODO |
| 5f | Copy the **Audience (AUD) tag** for each app and store it as GitHub Actions secrets (`CLOUDFLARE_ACCESS_AUDIENCE_ADMIN`, `CLOUDFLARE_ACCESS_AUDIENCE_TRADING`, `CLOUDFLARE_ACCESS_AUDIENCE_GATEWAY`, `CLOUDFLARE_ACCESS_AUDIENCE_API`) and as wrangler secrets only where the target canonical app still validates the token. | CF Access App → Overview tab | ⬜ TODO |
Create one Access application per protected subdomain group. All require Gate 4 to be complete.

**Important:** Keep Access audience tags aligned with the Worker that validates them. `api.goldshore.ai` is validated by `gs-api` with its API Access AUD, so it must stay on the API Access application unless the downstream Worker secret/config changes at the same time. `gw.goldshore.ai` and `agent.goldshore.ai` share the gateway Access application/AUD. Public probes (`/health`, `/status`) must be excluded via a bypass policy so monitoring scripts do not hit the login wall. Configure allowed login methods or OR policies from the canonical Cloudflare Access IdP matrix in `docs/domains-and-auth.md`; do not encode alternative IdPs as multiple conjunctive Require selectors.
**Important:** `api.goldshore.ai` is owned directly by the `gs-api` Worker route, while `agent.goldshore.ai` routes through the `gs-gateway` Worker. Configure Cloudflare Access audiences per owning Worker, and exclude public probes (`/health`, `/status`) via bypass policy so monitoring scripts do not hit the login wall.
**Important:** `api.goldshore.ai` and `agent.goldshore.ai` both route to the same `gs-gateway` Worker, which holds a single `CLOUDFLARE_ACCESS_AUDIENCE` binding. They **must share one Access application** so the same AUD tag validates tokens from either subdomain. Public probes (`/health`, `/status`) must be excluded via a bypass policy so monitoring scripts do not hit the login wall. Set all policy **Require** rules from the canonical Cloudflare Access IdP matrix in `docs/domains-and-auth.md`.

---

### GATE 6 — Admin custom domain migration for .org (BLOCKS: admin.goldshore.org)

| # | Action | Where | Status |
|---|--------|--------|--------|
| 6a | Maintain `gs-admin` custom domain only as legacy live routing; target admin UI belongs in `apps/gs-web` and admin APIs belong in `apps/gs-api`. | [CF Pages gs-admin](https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/pages/view/gs-admin) | ⬜ TODO |
| 6b | Verify DNS for `admin.goldshore.org` and plan cutover from legacy `gs-admin.pages.dev` to canonical app routing. | CF DNS → goldshore.org zone | ⬜ TODO |
| 6c | After Gate 5a — verify login wall appears at `https://admin.goldshore.org` | Browser | ⬜ TODO |

---

### GATE 7 — End-to-end smoke test (BLOCKS: trading dashboard work)

All gates above must be ✅ before trading dashboard Phase 1 begins.

| # | Check | Expected result | Status |
|---|-------|-----------------|--------|
| 7a | `https://goldshore.ai` | Public homepage loads | ⬜ TODO |
| 7b | `https://goldshore.org` | Public homepage loads from `gs-web-prod` | ⬜ TODO |
| 7c | `https://www.goldshore.ai` | 308 → goldshore.ai | ⬜ TODO |
| 7d | `https://www.goldshore.org` | 308 → goldshore.ai | ⬜ TODO |
| 7e | `https://admin.goldshore.ai` | CF Access login wall | ⬜ TODO |
| 7f | `https://admin.goldshore.org` | CF Access login wall | ⬜ TODO |
| 7g | `https://trading.goldshore.ai` | CF Access login wall | ⬜ TODO |
| 7h | `https://gw.goldshore.ai/status` | JSON health response; target implementation belongs in `apps/gs-api` (status.goldshore.ai reserved for gs-status Pages — not yet built) | ⬜ TODO |
| 7i | Contact form → email delivered to marstonr6@gmail.com | End-to-end mail test | ⬜ TODO |
| 7j | Update `Last certified` date at top of this file and commit after live verification is complete. | This file | ⬜ TODO |

---

## Schema migration protocol

- All schema changes go in `infra/migrations/<db>/<version>_<description>.sql`
- Versions are zero-padded 3-digit integers: `001`, `002`, `003`...
- Every migration must INSERT into `schema_migrations` table
- Migrations are applied via CI — never manually via dashboard
- Rollback = new forward migration only (no destructive rollbacks in production)
