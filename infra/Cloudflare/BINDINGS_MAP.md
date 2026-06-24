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

- Project: `gs-admin`
- Repo: `goldshore-ai`
- Root: `apps/gs-admin`
- Custom Domains:
  - `admin.goldshore.ai`
  - `admin-preview.goldshore.ai`

**Zero Trust:**

- Access policy required on `admin.goldshore.ai` (email allowlist).

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
  - `api-preview.goldshore.ai/*`

**Bindings:**

- KV:
  - Binding: `KV`
  - Namespace: `gs_api_kv_001` _(canonical; historical alias: `goldshore-api-kv`)_
- D1:
  - Binding: `DB`
  - Database: `goldshore` / `gs_db_001` _(historical alias: `goldshore-api-db`)_
- R2:
  - Binding: `ASSETS`
  - Bucket: `gs-assets` _(historical alias: `goldshore-api-assets`)_
- AI:
  - Binding: `AI`
  - Gateway: `goldshore-ai-gateway`

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
