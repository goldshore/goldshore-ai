# Gold Shore Labs — Cloudflare Bindings Map

**Last Updated**: 2026-09-01 (live Worker inventory reconciled; `gs-api-prod` →
`gs-api` and `gs-web-prod` → `gs-web` renames recorded)

> **Note**: `marzton/goldshore-core` repository has been archived. See Phase 4 decision in `docs/PHASE4_DECISION_2026_08.md`. 
> banproof-me continues as an independent product on banproof.me domain.

## Zones

- `goldshore.ai` — primary zone

---

## Live Worker inventory

Verified against the Cloudflare API for account `f77de112…` on **2026-09-01**.
These are the only Workers that exist in the account; script ids are stable
across renames, which is how the renames below were confirmed.

| Worker | Script id | In this repo |
|--------|-----------|--------------|
| `gs-api` | `a5322bde…` | `apps/gs-api` — renamed from `gs-api-prod` |
| `gs-web` | `7510e007…` | `apps/gs-web` — renamed from `gs-web-prod` |
| `goldclaw` | `8cb1347a…` | no |
| `armsway-com` | `f76fe989…` | no |
| `gearswipe` | `e801a6d5…` | no — renamed from `gearswipe-com` |
| `partners-in-pools` | `42d253a9…` | no |
| `banproof-me-prod` | `5d098901…` | no — separate product |
| `goldshore-{r2-explorer,workflows,agent-visibility}-reference` | — | no — reference samples |

**No longer in the account:** `gs-gateway`, `gs-gateway-prod`, `gs-signals-prod`,
`gs-control`, `banproof-me`, `gs-admin`, `gs-mail`, `gs-trading-prod`,
`gs-risk-radar`, `gs-www-redirect{,-prod,-production}`, `gs-api-{preview,staging}`,
`gs-todo`, `goldshore-ai`, `gs-email-router`. Sections below that still describe
these are retained for design history and are marked accordingly — do not treat
them as live infrastructure.

---

## Web / Admin front end

### 1. Web and admin UI

`apps/gs-web` is **not** a Pages project. It is an SSR Astro app served by the
`gs-web` Worker, deployed by the Cloudflare Workers Build git integration.
Hostnames are attached via the `routes` list in `apps/gs-web/wrangler.toml`, not
via Pages custom domains.

> **Renamed:** this Worker was `gs-web-prod` until it was renamed to `gs-web` in
> the dashboard (same script id, `7510e007…`). `[env.prod]` in
> `apps/gs-web/wrangler.toml` pins `name = "gs-web"` for that reason — without
> the pin, Wrangler derives `<name>-<env>` and `deploy --env prod` would
> recreate `gs-web-prod` and move the routes onto it, orphaning the live Worker.

- Worker: `gs-web` _(historical name: `gs-web-prod`)_
- Repo: `goldshore-ai`
- Root: `apps/gs-web`
- Routes (see `[env.prod]` in `apps/gs-web/wrangler.toml` for the authoritative list):
  - `goldshore.ai/*`, `goldshore.org/*`
  - `admin.goldshore.ai/*`, `admin-preview.goldshore.ai/*`, `admin.goldshore.org/*`
  - `risk.goldshore.ai/*`, `risk.goldshore.org/*`

The protected admin cockpit is the `/app` and `/admin` route tree in this same
Worker. There is no `apps/gs-admin` package, Pages project, or separate admin
Worker in the repository contract. Cloudflare Access remains required on both
admin hostnames. The root of either admin hostname redirects to
`/app/dashboard` after authorization.

A second deploy path — a static-only deployment of the client bundle in `.github/workflows/deploy-gs-web.yml` — was
removed. It shipped only the static client assets (dist/client has no
`_worker.js`), so it published a static shell that 404'd every SSR route while
competing with the Worker for the same hostnames.

`.github/workflows/deploy-gs-web.yml` is consequently named **Verify gs-web
build** and retains one immutable artifact keyed by the release SHA. Successful
Cloudflare deployment events trigger `verify-gs-web-deployment.yml`, which
compares the embedded release marker across every supported production mirror
and the two supported `.ai` preview hosts. No `.org` preview hostname is part of
the current Wrangler contract.

**Environment Variables:**

- `PUBLIC_API=https://api.goldshore.ai`
- `PUBLIC_GATEWAY=https://gw.goldshore.ai`

---

### 2. MCP Access Surface

- Host: `mcp.goldshore.ai`
- Worker: `gs-api` (route `mcp.goldshore.ai/*`), handler at `/mcp` _(historical name: `gs-api-prod`)_
- Purpose: private MCP endpoint for approved humans and approved agents
- Access: Cloudflare Access required before any private tool loads
- Transport: Streamable HTTP — JSON-RPC 2.0 over `POST /mcp`. `GET` returns 405;
  the surface is stateless, so it issues no `Mcp-Session-Id` and needs no KV or
  Durable Object binding.
- Bindings consumed: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (read-only
  Cloudflare API access for the four inventory tools).
- Notes:
  - Keep anonymous prompts and changes out of the surface.
  - Use a dedicated service identity path for agent automation.
  - There is no standalone MCP Worker. The former `goldshore-mcp` app in
    `marzton/goldshore` is superseded; it never ran in production because its
    `MCP_SESSIONS` namespace shipped `id = "placeholder_kv_id"` and it declared
    no `durable_objects` block for the `McpAgent` Durable Object it used.

---

## Workers

### 3. API Worker

- Service Name: `gs-api` _(historical name: `gs-api-prod`; renamed in the
  dashboard, same script id `a5322bde…`. `[env.prod]` in
  `apps/gs-api/wrangler.toml` pins `name = "gs-api"` so `deploy --env prod`
  does not recreate `gs-api-prod` and move these routes onto it.)_
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
  - Binding: `MCP_WORKERS_PROMPT`
  - Namespace: `mcp-workers-prompt-prod` / `mcp-workers-prompt-preview` _(MCP worker prompt templates and system instructions)_
- D1:
  - Binding: `PLATFORM_DB`
  - Database: `gs_platform_db` _(canonical platform database)_
  - Binding: `AUDIT_DB`
  - Database: `gs_audit_db`
  - Binding: `SIGNALS_DB`
  - Database: `gs_signals_db`
  - Binding: `RISK_RADAR_DB`
  - Database: `gs_risk_radar_db` _(Risk Radar canonical structured storage; API-only)_
  - Binding: `JOBS_DB`
  - Database: `gs_jobs_db`
- R2:
  - Binding: `GS_ASSETS`
  - Bucket: `gs-assets` _(historical alias only: `ASSETS`)_
  - Binding: `RISK_RADAR_R2`
  - Bucket: `gs-risk-radar-raw` / `gs-risk-radar-raw-preview` _(Risk Radar raw source object storage; API-only)_
- AI:
  - Binding: `AI`
  - Gateway: `goldshore-ai-gateway`
- Worker secrets:
  - Binding: `INTEGRATION_MASTER_KEY`
  - Secret: `INTEGRATION_MASTER_KEY` (normal Worker secret; do not configure `secrets_store_secrets` until the referenced Cloudflare Secrets Store exists)
  - Binding: `GS_GITHUB_WEBHOOK_SECRET`
  - Secret: `GS_GITHUB_WEBHOOK_SECRET` (HMAC verification for the four repository webhook endpoints)

**Risk Radar storage policy:** bind Risk Radar storage only to `gs-api`; `gs-web` must call API endpoints rather than receiving `RISK_RADAR_DB`, `RISK_RADAR_CACHE`, or `RISK_RADAR_R2` directly.

**Unclear live-state note:** legacy dashboard service bindings such as `AGENT`, `GS_MAIL`, `GS_WEB`, `GS_WEB PROD`, `API_SERVICE`, `GOLDSHORE_AI`, and historical store-object binding `SECRETS` are not part of the repo-managed `gs-api` binding set. If present in Cloudflare, validate traffic before deleting, but do not reintroduce them into Wrangler config without an ADR update.

---

### 4. Gateway Worker — RETIRED, not live

> Neither `gs-gateway` nor `gs-gateway-prod` exists in the account as of
> 2026-09-01, and there is no `apps/gs-gateway` in this repo — CLAUDE.md lists
> `gs-gateway` among the unsupported legacy app names, and
> `marzton/goldshore-gateway` was archived 2026-08-22. Gateway responsibilities
> belong in `apps/gs-api`. Kept for design history only.

- Service Name: `gs-gateway` _(retired)_
- Code: `apps/gs-gateway` _(no longer present in this repo)_
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

### 5. Control Worker — RETIRED, not live

> `gs-control` does not exist in the account as of 2026-09-01, and
> `apps/gs-control` was removed from this repo in the Phase 1-3 cleanup
> (2026-08-22, see CLAUDE.md). `ops.goldshore.ai/*` is served by `gs-api`.
> Kept for design history only.

- Service Name: `gs-control` _(retired)_
- Code: `apps/gs-control` _(no longer present in this repo)_
- Routes:
  - `ops.goldshore.ai/*`

**Bindings:**

- Env Vars:
  - `CLOUDFLARE_API_TOKEN` (secret)
  - `CLOUDFLARE_ACCOUNT_ID` (secret)
  - `CONTROL_SERVICE=true`

---

### 6. Banproof-Me Security Worker

- Service Name: `banproof-me-prod` _(the `banproof-me` Worker no longer exists
  in the account as of 2026-09-01; `banproof-me-prod` is the live one)_
- Config: `marzton/goldshore-core/apps/banproof-me/wrangler.toml`
- External domain: `banproof.me` (independent product, not part of goldshore-ai platform)
- Status: **Independent standalone service** (Phase 4: 2026-08-22)
- Note: banproof-me is deployed separately; it shares platform infrastructure (gs_platform_db, INFRA_SECRETS) but is not consolidated into goldshore-ai

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

### 7. Gateway Worker — Phase 2 Joinery Bindings — RETIRED, not live

> Superseded along with section 4: the `gs-gateway` Worker it binds to is gone,
> and so are two of its three targets — `gs-signals-prod` and `banproof-me` are
> both absent from the account as of 2026-09-01 (`banproof-me-prod` is the live
> ban-check Worker). Kept for design history only.

Additional bindings added to `gs-gateway` (`apps/gs-gateway/wrangler.toml`) for Phase 2:

- Service:
  - Binding: `SECURITY` — `banproof-me` (ban / security checks) _(target retired; live Worker is `banproof-me-prod`)_
  - Binding: `SIGNALS` — `gs-signals-prod` (trading signals worker) _(target retired)_
- Queue (producer):
  - Binding: `MAIL_QUEUE` — `gs-mail-jobs` queue
