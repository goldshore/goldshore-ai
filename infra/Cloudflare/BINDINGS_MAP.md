<<<<<<< ours
# Gold Shore Labs — Cloudflare Bindings Map

## Zones

- `goldshore.ai` — primary zone

---

## Pages Projects

### 1. Web (Public)

- Project: `gs-web`
- Repo: `goldshore-ai`
- Root: `apps/gs-web`
- Custom Domains:
  - `goldshore.ai`
  - `www.goldshore.ai`
  - `preview.goldshore.ai`

**Environment Variables:**

- `PUBLIC_API=https://api.goldshore.ai`
- `PUBLIC_GATEWAY=https://gw.goldshore.ai`

**Runtime data bindings:**

- None. `gs-web` must not bind `KV`, `DB`, or `GS_ASSETS`; contact, lead, and form configuration storage is served through `gs-api` (`/v1/forms/*`).
- Do not add `GS_CONFIG` unless a specific Pages Function requires public, request-time, read-only config reads.

---

### 2. Admin (Cockpit)

`admin.goldshore.ai` was migrated off the standalone `gs-admin` Pages project onto `gs-web` (route `admin.goldshore.ai/*` in `apps/gs-web/wrangler.toml`), per CLAUDE.md's repo migration plan. The DNS/routing cutover is done; the actual admin page/route content under `apps/gs-admin/src` has not been ported into `apps/gs-web` yet — that migration is in progress.

- Project (legacy, not yet retired): `gs-admin`
- Repo: `goldshore-ai`
- Root: `apps/gs-admin`
- Custom Domains still on the legacy project:
  - `admin-preview.goldshore.ai`
  - `admin.goldshore.org` (pending the separate `goldshore.org` ownership conflict — see `policy/ROUTE_POLICY.md` vs `docs/architecture/domain-ownership.md`)

**Zero Trust:**

- Access policy required on `admin.goldshore.ai` (email allowlist) — unchanged by the cutover, still applies to the same hostname regardless of which Worker/Pages project serves it.

**Environment Variables:**

- `PUBLIC_API=https://api.goldshore.ai`
- `PUBLIC_GATEWAY=https://gw.goldshore.ai`

---

### 2b. MCP Access Surface

- Host: `mcp.goldshore.ai`
- Purpose: private MCP endpoint for approved humans and approved agents
- Access: Cloudflare Access required before any private tool loads
- Notes:
  - Keep anonymous prompts and changes out of the surface.
  - Use a dedicated service identity path for agent automation.

---

## Workers

### 3. API Worker

- Service Name: `gs-api`
- Code: `apps/gs-api`
- Routes:
  - `api.goldshore.ai/*`
  - `api.goldshore.org/*`
  - `agent.goldshore.ai/*`
  - `mail.goldshore.ai/*`
  - `ops.goldshore.ai/*`
  - `trading.goldshore.ai/*`
  - `dashboard.goldshore.ai/*`
  - `dash.goldshore.ai/*`
  - `api-preview.goldshore.ai/*`

**Bindings:**

- KV:
  - Binding: `KV`
  - Namespace: `gs_api_kv_001` _(canonical; historical alias: `goldshore-api-kv`)_
  - Binding: `RISK_RADAR_CACHE`
  - Namespace: `gs-risk-radar-cache` / `gs-risk-radar-cache-preview` _(Risk Radar response and signal cache; API-only)_
- D1:
<<<<<<< ours
<<<<<<< ours
=======
>>>>>>> theirs
  - Binding: `PLATFORM_DB`
  - Database: `gs_platform_db` _(canonical platform database)_
  - Binding: `AUDIT_DB`
  - Database: `gs_audit_db`
  - Binding: `SIGNALS_DB`
  - Database: `gs_signals_db`
<<<<<<< ours
  - Binding: `RISK_RADAR_DB`
  - Database: `gs_risk_radar_db` _(Risk Radar canonical structured storage; API-only)_
  - Binding: `JOBS_DB`
  - Database: `gs_jobs_db`
- R2:
  - Binding: `GS_ASSETS`
  - Bucket: `gs-assets` _(historical alias only: `ASSETS`)_
=======
  - Binding: `DB`
  - Database: `goldshore` / `gs_db_001` _(historical alias: `goldshore-api-db`)_
=======
>>>>>>> theirs
  - Binding: `RISK_RADAR_DB`
  - Database: `gs_risk_radar_db` _(Risk Radar canonical structured storage; API-only)_
  - Binding: `JOBS_DB`
  - Database: `gs_jobs_db`
- R2:
<<<<<<< ours
  - Binding: `ASSETS`
  - Bucket: `gs-assets` _(historical alias: `goldshore-api-assets`)_
>>>>>>> theirs
=======
  - Binding: `GS_ASSETS`
  - Bucket: `gs-assets` _(historical alias only: `ASSETS`)_
>>>>>>> theirs
  - Binding: `RISK_RADAR_R2`
  - Bucket: `gs-risk-radar-raw` / `gs-risk-radar-raw-preview` _(Risk Radar raw source object storage; API-only)_
- AI:
  - Binding: `AI`
  - Gateway: `goldshore-ai-gateway`
<<<<<<< ours
- Worker secrets:
  - Binding: `INTEGRATION_MASTER_KEY`
  - Secret: `INTEGRATION_MASTER_KEY` (normal Worker secret; do not configure `secrets_store_secrets` until the referenced Cloudflare Secrets Store exists)

**Risk Radar storage policy:** bind Risk Radar storage only to `gs-api`; `gs-web` must call API endpoints rather than receiving `RISK_RADAR_DB`, `RISK_RADAR_CACHE`, or `RISK_RADAR_R2` directly.

**Unclear live-state note:** legacy dashboard service bindings such as `AGENT`, `GS_MAIL`, `GS_WEB`, `GS_WEB PROD`, `API_SERVICE`, `GOLDSHORE_AI`, and historical store-object binding `SECRETS` are not part of the repo-managed `gs-api` binding set. If present in Cloudflare, validate traffic before deleting, but do not reintroduce them into Wrangler config without an ADR update.
=======
- Secrets Store:
  - Binding: `INTEGRATION_MASTER_KEY`
  - Store: `b9824d3280c54573a24137c7e7143b33`
  - Secret: `INTEGRATION_MASTER_KEY`
>>>>>>> theirs

**Risk Radar storage policy:** bind Risk Radar storage only to `gs-api`; `gs-web` must call API endpoints rather than receiving `RISK_RADAR_DB`, `RISK_RADAR_CACHE`, or `RISK_RADAR_R2` directly.

**Unclear live-state note:** legacy dashboard service bindings such as `AGENT`, `GS_MAIL`, `GS_WEB`, `GS_WEB PROD`, `API_SERVICE`, `GOLDSHORE_AI`, and historical store-object binding `SECRETS` are not part of the repo-managed `gs-api` binding set. If present in Cloudflare, validate traffic before deleting, but do not reintroduce them into Wrangler config without an ADR update.

---

### 4. Gateway Worker

- Service Name: `gs-gateway`
- Code: `apps/gs-gateway`
- Routes:
  - `gw.goldshore.ai/*`
  - `agent.goldshore.ai/*`
  - `gw-preview.goldshore.ai/*`

**Bindings:**

- Service:
  - Binding: `API`
  - Service: `gs-api`
  - Environment: `production`
- Service:
  - Binding: `AGENT`
  - Service: `gs-agent`
  - Environment: `prod`
- KV:
  - Binding: `GATEWAY_KV`
  - Namespace: `goldshore-gw-kv`
- D1 (optional telemetry):
  - Binding: `DB`
  - Database: `goldshore-telemetry-db`

---

### 5. Control Worker

- Service Name: `gs-control`
- Code: `apps/gs-control`
- Routes:
  - `ops.goldshore.ai/*`

**Bindings:**

- Env Vars:
  - `CLOUDFLARE_API_TOKEN` (secret)
  - `CLOUDFLARE_ACCOUNT_ID` (secret)
  - `CONTROL_SERVICE=true`

---

### 6. Banproof-Me Security Worker

- Service Name: `banproof-me`
- Config: `apps/banproof-me/wrangler.toml`
- External domain: `banproof.me`
- Bound as `SECURITY` in `gs-gateway`

**Bindings (9 platform bindings):**

- KV:
  - Binding: `BANPROOF_KV` — real-time ban cache
  - Binding: `GOLDSHORE_KV` — shared platform config / feature flags
- D1:
  - Binding: `BAN_DB` — `gs_platform_db` (ban records, user reputation)
  - Binding: `AUDIT_DB` — `gs_audit_db` (compliance audit log)
  - Binding: `SIGNALS_DB` — `gs_signals_db` (trading signal association)
- R2:
  - Binding: `ASSETS` — `gs-assets` (shared media/assets)
  - Binding: `TELEMETRY` — `gs-telemetry-storage` (compliance telemetry)
- Service:
  - Binding: `API_SERVICE` — `gs-api` / `prod` (reputation lookups)
- Queue (producer):
  - Binding: `BAN_EVENTS` — `ban-events` queue

---

### 7. Gateway Worker — Phase 2 Joinery Bindings

Additional bindings added to `gs-gateway` (`apps/gs-gateway/wrangler.toml`) for Phase 2:

- Service:
  - Binding: `SECURITY` — `banproof-me` (ban / security checks)
  - Binding: `SIGNALS` — `gs-signals-prod` (trading signals worker)
- Queue (producer):
  - Binding: `MAIL_QUEUE` — `gs-mail-jobs` queue
=======
# GoldShore Cloudflare Binding Registry

This document is the canonical registry for Cloudflare bindings in the two-app monorepo. Binding names in Wrangler config, TypeScript `Env` interfaces, route handlers, and docs must match this table exactly.

Merge strategy: squash

## Binding rules

- Only `apps/gs-api` and `apps/gs-web` may own app bindings.
- Do not add Cloudflare bindings for retired satellite workers such as `gs-agent`, `gs-gateway`, `gs-mail`, `gs-control`, or `banproof-me` inside this monorepo.
- Prefer descriptive resource names (`PLATFORM_DB`, `GS_ASSETS`) over generic legacy aliases (`DB`, `ASSETS`) when a resource is shared or its purpose is not local-only.
- When removing a legacy alias, update all of these at the same time: `wrangler.toml`, TypeScript `Env`, application code, tests, and docs.

## Canonical binding table

| Canonical binding name | Cloudflare resource type | Cloudflare resource title/name | Resource ID | Allowed app owner | Allowed access mode | Legacy aliases to remove |
|---|---|---|---|---|---|---|
| `KV` | Workers KV namespace | Production API namespace: `gs_api_kv_001`; preview API namespace | Prod: `e0b8b807191346c3b0afc25fe716d2cd`; preview: `d4d20cee39094b999dea3f7e5f4c533a` | `apps/gs-api` | read-write | `API_KV`, `GS_CONFIG`, `goldshore-api-kv` |
| `CONTROL_LOGS` | Workers KV namespace | Production control logs namespace; preview control logs namespace | Prod: `a52e94cb331c4e3db08f2aa507e6df09`; preview: `09e43cb8bd4749fdaaed0dc9d4ff2284` | `apps/gs-api` | read-write | `LOGS_KV`, `CONTROL_KV` |
| `PLATFORM_DB` | D1 database | `gs_platform_db` | `9703574e-adb7-481e-8d98-96f8ce5f8a90` | `apps/gs-api`, `apps/gs-web` | `apps/gs-api`: read-write; `apps/gs-web`: read-write only for public form submissions and admin form management | `DB`, `BAN_DB`, `goldshore-api-db` |
| `AUDIT_DB` | D1 database | `gs_audit_db` | `1ae71d76-188f-481b-91d9-db2d39013f68` | `apps/gs-api` | read-write | `AUDIT_LOG_DB`, `TELEMETRY_DB` |
| `SIGNALS_DB` | D1 database | `gs_signals_db` | `76af4653-7f44-417b-b46e-250143d906fd` | `apps/gs-api` | read-write | `SIGNAL_DB`, `SIGNALS` |
| `JOBS_DB` | D1 database | `gs_jobs_db` | `750c469c-788d-49e8-9254-77231cffd70f` | `apps/gs-api` | read-write | `QUEUE_DB`, `JOB_DB` |
| `GS_ASSETS` | R2 bucket | Production: `gs-assets`; preview: `gs-assets-preview` | Not applicable | `apps/gs-api`, `apps/gs-web` | `apps/gs-api`: read-write; `apps/gs-web`: read-only unless explicitly serving build assets through the Worker Assets binding | `ASSETS`, `MEDIA`, `goldshore-api-assets` |
| `TELEMETRY` | R2 bucket | `gs-telemetry-storage` | Not applicable | `apps/gs-api` | producer | `TELEMETRY_BUCKET`, `TELEMETRY_STORAGE` |
| `AI` | Workers AI binding | Cloudflare Workers AI / AI Gateway-backed model access | Not applicable | `apps/gs-api` | service caller | `CF_AI`, `GOLDSHORE_AI`, `goldshore-ai-gateway` |
| `AUTH_SESSION` | Durable Object namespace | `AuthSession` | Not applicable | `apps/gs-api` | read-write | `SESSION_DO`, `AUTH_DO` |
| `SECRETS` | Secrets Store binding | GoldShore integration secrets store | `b9824d3280c54573a24137c7e7143b33` | `apps/gs-api` | read-only secret lookup | `SECRET_STORE`, `INTEGRATION_SECRETS` |
| `JOBS_QUEUE` | Queue producer | `goldshore-jobs` | Not applicable | `apps/gs-api` | producer | `JOB_QUEUE`, `AGENT_QUEUE` |
| `EVENTS_QUEUE` | Queue producer | `gs-events` | Not applicable | `apps/gs-api` | producer | `EVENT_QUEUE`, `PLATFORM_EVENTS` |
| `MAIL_JOBS_QUEUE` | Queue producer | `gs-mail-jobs` | Not applicable | `apps/gs-api` | producer | `MAIL_QUEUE`, `GS_MAIL_QUEUE` |
| `DEAD_LETTER_QUEUE` | Queue producer | `gs-mail-dead-letter` | Not applicable | `apps/gs-api` | producer | `DLQ`, `MAIL_DEAD_LETTER` |
| `KV` | Workers KV namespace | Web runtime namespace | `5f13370575784c9dacff522121104cb3` | `apps/gs-web` | read-write for form-submission fallback/cache only | `WEB_KV`, `GS_CONFIG` |
| `ASSETS` | Worker Assets binding | Astro build assets from `apps/gs-web/dist` | Not applicable | `apps/gs-web` | read-only asset serving | `STATIC_ASSETS`, `SITE_ASSETS` |

## Environment variable names

The following are vars/secrets rather than Cloudflare resource bindings and must not be represented as KV, D1, R2, or service bindings:

| Name | Owner | Purpose |
|---|---|---|
| `ENV` | `apps/gs-api`, `apps/gs-web` | Runtime environment label. |
| `CLOUDFLARE_ACCESS_AUDIENCE` | `apps/gs-api`, `apps/gs-web` | Cloudflare Access JWT audience. |
| `CLOUDFLARE_TEAM_DOMAIN` | `apps/gs-api`, `apps/gs-web` | Cloudflare Access team domain. |
| `GOOGLE_OAUTH_CLIENT_ID` | `apps/gs-api` | GoldClaw Google OAuth public client identifier. |
| `GOOGLE_OAUTH_REDIRECT_URI` | `apps/gs-api` | GoldClaw OAuth callback URL. |
| `CONTACT_NOTIFICATION_EMAILS` | `apps/gs-web` | Form notification recipients. |
| `MAILCHANNELS_SENDER_NAME` | `apps/gs-web` | Display name for form notification mail. |

## Retired binding families

These names are intentionally absent from the canonical tables and must not be reintroduced:

- Service bindings to retired app workers: `AGENT`, `GS_MAIL`, `GS_WEB`, `API_SERVICE`, `GATEWAY`, `SECURITY`, `SIGNALS`.
- Legacy app-local D1 aliases: `DB`, `BAN_DB`, `AUDIT_LOG_DB`, `TELEMETRY_DB`.
- Legacy R2 aliases: `ASSETS` in `apps/gs-api`; `MEDIA`; `TELEMETRY_BUCKET`.
- Legacy queue aliases: `MAIL_QUEUE`, `CHECKOUT_EVENTS_QUEUE`, `CONTACT_EVENTS_QUEUE`.
>>>>>>> theirs
