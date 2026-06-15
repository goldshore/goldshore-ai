# Gold Shore Labs — Canonical Infrastructure Manifest

> **This file is the source of truth. No AI agent, no PR, no human may change
> Cloudflare resources without a corresponding change to this file passing CI.**
>
> Last certified: 2026-04-29 | Certified by: Rob Marston (@marzton)

---

## Account

| Key | Value |
|---|---|
| Account ID | `f77de112d2019e5456a3198a8bb50bd2` |
| Subdomain | `goldshore.workers.dev` |
| Account name | Gold Shore Labs |

---

## Workers (canonical set — 21 active)

| Worker name | Purpose | Domains served | Fail policy |
|---|---|---|---|
| `gs-platform` | Main gateway — auth, CORS, routing hub | goldshore.ai, armsway.com | Fail closed on auth routes |
| `gs-api` | API layer | api.goldshore.ai | Fail closed |
| `gs-admin` | Admin dashboard worker | admin.goldshore.ai | Fail closed |
| `gs-gateway` | Legacy gateway (to be superseded by gs-platform) | — | Fail closed |
| `gs-agent` | AI agent worker | — | Fail closed |
| `gs-control` | Build control service | — | Fail closed |
| `goldshore-org` | goldshore.org site | goldshore.org | Fail open (public) |
| `banproof-me` | Proof-of-Agency security layer, contact forms, PoA workflow | banproof.me | Fail closed |
| `banproof-email-router` | Email routing for banproof | — | Fail closed |
| `gs-core-worker` | Gearswipe/StellarAIO ATC trigger, signals consumer | — | Fail closed |
| `gs-signals-prod` | Polygon sentiment analysis, signal generation | — | Fail closed |
| `gs-mail` | Transactional mail dispatch | — | Fail closed |
| `gs-web` | goldshore.ai frontend static assets | goldshore.ai | Fail open (public) |
| `gs-web-staging` | Staging variant of gs-web | staging.goldshore.ai | Fail open |
| `rmarston-com` | rmarston.com personal site | rmarston.com | Fail open (public) |
| `goldshore-ai` | (Audit pending — may be stub) | — | TBD |
| `gs-todo` | (Audit pending — may be internal tool) | — | TBD |
| `gs-trading` | Schwab + Robinhood brokerage integration, trading API, risk engine | — | Fail closed |
| `armsway-com` | armsway.com site worker | armsway.com | Fail open (public) |
| `gs-www-redirect` | www → apex redirect worker | www.goldshore.ai | Fail open |
| `banproof` | BanProof legacy worker | — | Fail closed |
| `partners-in-pools` | (Audit pending — origin unknown, live in account) | — | TBD |

**Workers NOT on this list must not exist. Any unrecognized worker = immediate audit.**

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
| `GOLDSHORE_ORG_KV` | GOLDSHORE-ORG | `a59a5e2f446348629f59fb21ea69d795` | goldshore-org worker |
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

| Domain | Worker | Tier | Fail policy |
|---|---|---|---|
| `goldshore.ai` | `gs-platform` / `gs-web` | 1 (public) | Fail open |
| `www.goldshore.ai` | `gs-platform` | 1 (public) | Fail open |
| `admin.goldshore.ai` | `gs-platform` | 3 (admin) | Fail closed |
| `goldshore.org` | `goldshore-org` | 1 (public) | Fail open |
| `banproof.me` | `banproof-me` | 1 | Fail closed |
| `rmarston.com` | `rmarston-com` | 1 (public) | Fail open |
| `www.rmarston.com` | `rmarston-com` | 1 (public) | Fail open |
| `armsway.com` | `gs-platform` | 1 (public) | Fail open |
| `www.armsway.com` | `gs-platform` | 1 (public) | Fail open |

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

## Schema migration protocol

- All schema changes go in `infra/migrations/<db>/<version>_<description>.sql`
- Versions are zero-padded 3-digit integers: `001`, `002`, `003`...
- Every migration must INSERT into `schema_migrations` table
- Migrations are applied via CI — never manually via dashboard
- Rollback = new forward migration only (no destructive rollbacks in production)
