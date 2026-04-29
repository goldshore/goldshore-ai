# Gold Shore Labs — Cloudflare Bindings Map

## Zones

- `goldshore.ai` — primary zone

---

## Pages Projects

### 1. Web (Public)

- Project: `astro-gs-web`
- Repo: `astro-goldshore`
- Root: `apps/gs-web`
- Custom Domains:
  - `goldshore.ai`
  - `preview.goldshore.ai`

**Environment Variables:**

- `PUBLIC_API=https://api.goldshore.ai`
- `PUBLIC_GATEWAY=https://gw.goldshore.ai`

---

### 2. Admin (Cockpit)

- Project: `astro-gs-admin`
- Repo: `astro-goldshore`
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

## Workers

### 3. API Worker

- Service Name: `astro-gs-api`
- Code: `apps/gs-api`
- Routes:
  - `api.goldshore.ai/*`
  - `api-preview.goldshore.ai/*`

**Bindings:**

- KV:
  - Binding: `API_KV`
  - Namespace: `goldshore-api-kv`
- D1:
  - Binding: `DB`
  - Database: `goldshore-api-db`
- R2:
  - Binding: `ASSETS`
  - Bucket: `goldshore-api-assets`
- AI:
  - Binding: `AI`
  - Gateway: `goldshore-ai-gateway`

---

### 4. Gateway Worker

- Service Name: `astro-gs-gateway`
- Code: `apps/gs-gateway`
- Routes:
  - `gw.goldshore.ai/*`
  - `gw-preview.goldshore.ai/*`

**Bindings:**

- Service:
  - Binding: `API`
  - Service: `astro-gs-api`
  - Environment: `production`
- KV:
  - Binding: `GATEWAY_KV`
  - Namespace: `goldshore-gw-kv`
- D1 (optional telemetry):
  - Binding: `DB`
  - Database: `goldshore-telemetry-db`

---

### 5. Control Worker

- Service Name: `goldshore-control-worker`
- Code: `apps/gs-control`
- Routes:
  - `ops.goldshore.ai/*` (optional, or workers.dev only)

**Bindings:**

- Env Vars:
  - `CLOUDFLARE_API_TOKEN` (secret)
  - `CLOUDFLARE_ACCOUNT_ID` (secret)
  - `ENVIRONMENT=production`
