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
- Secrets Store:
  - Binding: `INTEGRATION_MASTER_KEY`
  - Store: `b9824d3280c54573a24137c7e7143b33`
  - Secret: `INTEGRATION_MASTER_KEY`
- Worker secrets:
  - Binding: `INTEGRATION_MASTER_KEY`
  - Secret: `INTEGRATION_MASTER_KEY` (normal Worker secret; do not configure `secrets_store_secrets` until the referenced Cloudflare Secrets Store exists)

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
