# Cloudflare Workers Deployment Configuration

> Last Updated: 2026-08-09  
> Managed By: MCP Cloudflare Developer Platform Tools  
> Alternative To: wrangler CLI deployment

---

## Overview

This configuration enables AI-driven deployment management via MCP tools instead of manual wrangler CLI commands. The AI repository can query prod/preview environment status, bindings, and routes directly.

---

## Workers Inventory

### Production Workers (env.prod)

| Worker Name | Service | Routes | Status | Bindings |
|-------------|---------|--------|--------|----------|
| `gs-api` | Unified API gateway | api.goldshore.ai, agent.goldshore.ai, mail.goldshore.ai, ops.goldshore.ai, trading.goldshore.ai, dashboard.goldshore.ai, dash.goldshore.ai, gw.goldshore.ai, api.goldshore.org | ✅ Active | KV, D1 (PLATFORM_DB, AUDIT_DB, SIGNALS_DB, RISK_RADAR_DB, JOBS_DB), R2 (GS_ASSETS, TELEMETRY, RISK_RADAR_R2), AI, Queues, Workflows |
| `gs-web` | Frontend (Astro) | goldshore.ai/*, www.goldshore.ai/*, preview.goldshore.ai/* | ✅ Active | KV (GOLDSHORE-AI), R2 (GS_ASSETS), SESSION |
| `gs-platform` | Internal gateway | Internal service binding only | ✅ Active | KV (GATEWAY_KV, GOLDSHORE_KV), D1 (PLATFORM_DB), R2 (GS_ASSETS), Service bindings (SECURITY: banproof-me) |
| `gs-gateway` | External traffic router | External domain routing | ✅ Active | Service bindings (GS_PLATFORM, CONTROL) |
| `gs-mail` | Email queue consumer | Internal queue consumer | ✅ Active | D1 (AUDIT_DB), Queues (MAIL_JOBS_QUEUE, DEAD_LETTER_QUEUE) |
| `gs-control` | Control plane | Webhook receiver, state sync | ✅ Active | KV (CONTROL_LOGS), D1 (PLATFORM_DB) |
| `gs-agent` | Agent orchestrator | ops.goldshore.ai/* | ✅ Active | KV, D1, AI |
| `gs-trading` | Trading engine | trading.goldshore.ai/* | ✅ Active | KV (TRADING_KV), D1 (PAPER_DB) |
| `gs-core-worker` | Legacy core | Deprecated, kept for compatibility | ⚠️ Legacy | Limited bindings |
| `banproof-me` | Security/ban-check service | External; bound via service binding | ✅ Active | Own bindings |
| `armsway-com` | Domain-specific worker | armsway.com/* | ✅ Active | Own bindings |
| `gs-www-redirect` | WWW redirect | www.goldshore.org/*, www.armsway.com/* | ✅ Active | Minimal (routes only) |

### Preview Workers (env.preview)

All workers above have preview versions deployed to:
- `*-preview.goldshore.ai` (custom domains)
- `.workers.dev` subdomains (Cloudflare-hosted)

**Key difference:** Preview routes use different patterns and KV/D1 instances where applicable.

---

## MCP Tool Integration

### Available Cloudflare MCP Tools

#### 1. **List Workers**
```
mcp__Cloudflare_Developer_Platform__workers_list
  ├─ account_id: "f77de112d2019e5456a3198a8bb50bd2" (Gold Shore Labs)
  └─ Returns: All workers, versions, status, last deployed
```

**Use Case:** Check which workers are deployed to prod/preview

#### 2. **Get Worker Details**
```
mcp__Cloudflare_Developer_Platform__workers_get_worker
  ├─ account_id: "f77de112d2019e5456a3198a8bb50bd2"
  ├─ worker_name: "gs-api"
  ├─ environment: "prod" | "preview"
  └─ Returns: Routes, bindings, environment variables, secrets count
```

**Use Case:** Verify prod/preview environment configuration

#### 3. **Get Worker Code**
```
mcp__Cloudflare_Developer_Platform__workers_get_worker_code
  ├─ account_id: "f77de112d2019e5456a3198a8bb50bd2"
  ├─ worker_name: "gs-api"
  ├─ environment: "prod" | "preview"
  └─ Returns: Full worker source code
```

**Use Case:** Audit deployed code differs from repo

#### 4. **List & Inspect Bindings**
```
mcp__Cloudflare_Developer_Platform__kv_namespaces_list
  ├─ account_id: "f77de112d2019e5456a3198a8bb50bd2"
  └─ Returns: KV namespace IDs, sizes, last modified

mcp__Cloudflare_Developer_Platform__d1_databases_list
  ├─ account_id: "f77de112d2019e5456a3198a8bb50bd2"
  └─ Returns: D1 database IDs, tables, versions, backups

mcp__Cloudflare_Developer_Platform__r2_buckets_list
  ├─ account_id: "f77de112d2019e5456a3198a8bb50bd2"
  └─ Returns: R2 bucket names, sizes, object counts
```

**Use Case:** Validate bindings match wrangler.toml configuration

#### 5. **Query D1 Databases**
```
mcp__Cloudflare_Developer_Platform__d1_database_query
  ├─ account_id: "f77de112d2019e5456a3198a8bb50bd2"
  ├─ database_id: "9703574e-adb7-481e-8d98-96f8ce5f8a90" (PLATFORM_DB prod)
  └─ SQL: "SELECT * FROM admin_cache LIMIT 10"
```

**Use Case:** Query audit data, cache state, deployment logs

---

## Deployment Workflow (MCP-Based)

### Current (Wrangler CLI)
```
Developer runs:
  wrangler deploy --env prod
  
Deploys to:
  ✅ gs-api to prod (routes configured in wrangler.toml)
  ✅ Creates service version
  ✅ Rolls back on error

Visibility:
  ❌ No AI-driven monitoring
  ❌ Manual GitHub Actions only
```

### New (MCP + Cloudflare API)
```
1. **Pre-deployment checks** (MCP):
   - Get current worker version (gs-api prod)
   - List all bindings (verify KV, D1, R2 IDs match wrangler.toml)
   - Query D1 audit logs (check for active deployments)
   
2. **Deploy** (still wrangler, but verified):
   wrangler deploy --env prod
   
3. **Post-deployment validation** (MCP):
   - Get new worker version (compare source code hash)
   - Verify routes are active
   - Query D1 admin_cache (check if new routes working)
   - Log deployment to audit_logs table
   
4. **Monitoring** (MCP periodic checks):
   - Every 5 min: Check worker status
   - Every hour: Verify bindings match config
   - Every day: Compare deployed vs. repo versions
```

---

## Repository Integration

### New Files Added

#### `infra/Cloudflare/WORKERS_DEPLOYMENT_CONFIG.md` (this file)
- Inventory of all workers
- MCP tool mappings
- Binding configuration reference

#### `infra/Cloudflare/WORKERS_ENVIRONMENTS.json`
- Structured prod/preview environment config
- Used by MCP queries for validation
- Source of truth for binding IDs and environment vars

#### `.github/workflows/verify-worker-deployment.yml`
- Runs post-deploy validation via MCP tools
- Checks bindings, routes, code hash
- Logs results to D1 audit table

#### `apps/gs-api/src/routes/admin/deployment-status.ts`
- New route: `GET /admin/deployment-status`
- Returns prod/preview environment state
- Queries Cloudflare API via environment secrets
- Shows last deployed versions, routes, bindings

---

## Configuration: Prod & Preview Environments

### Prod Environment

**Account ID:** `f77de112d2019e5456a3198a8bb50bd2` (Gold Shore Labs)

**Workers:**
- gs-api (production)
- gs-web (pages)
- gs-platform (internal)
- gs-gateway (external)
- gs-mail (queue consumer)
- gs-control (control plane)

**Key Bindings:**
- KV: `e0b8b807191346c3b0afc25fe716d2cd` (GS_API_KV)
- D1: `9703574e-adb7-481e-8d98-96f8ce5f8a90` (PLATFORM_DB)
- R2: `gs-assets` bucket

**Routes:**
- api.goldshore.ai/* → gs-api
- *.goldshore.ai/* → gs-gateway → gs-platform or gs-web
- armsway.com/* → armsway-com worker

### Preview Environment

**Account ID:** Same (Gold Shore Labs)

**Workers:**
- gs-api-preview (or gs-api env=preview)
- gs-web-preview
- Others follow same naming

**Key Bindings:**
- KV: `d4d20cee39094b999dea3f7e5f4c533a` (GS_API_KV preview)
- D1: Same databases (different schema versions may be in use)
- R2: Same buckets (separate prefix for preview data)

**Routes:**
- api-preview.goldshore.ai/* → gs-api (env=preview)
- preview.goldshore.ai/* → gs-web (env=preview)

---

## MCP Query Examples

### Check Production Deployment Status
```
Tool: mcp__Cloudflare_Developer_Platform__workers_list
Params:
  account_id: "f77de112d2019e5456a3198a8bb50bd2"

Result:
  [
    {
      id: "gs-api-prod-v123",
      name: "gs-api",
      environment: "production",
      created_on: "2026-08-09T15:30:00Z",
      modified_on: "2026-08-09T18:45:00Z",
      routes: [ "api.goldshore.ai/*", ... ],
      status: "active"
    },
    ...
  ]
```

### Verify Prod Bindings
```
Tool: mcp__Cloudflare_Developer_Platform__workers_get_worker
Params:
  account_id: "f77de112d2019e5456a3198a8bb50bd2"
  worker_name: "gs-api"
  environment: "prod"

Result:
  {
    name: "gs-api",
    routes: [
      { pattern: "api.goldshore.ai/*", zone_name: "goldshore.ai" },
      ...
    ],
    bindings: [
      { name: "KV", type: "kv_namespace", id: "e0b8b8..." },
      { name: "PLATFORM_DB", type: "d1", database_id: "9703574e..." },
      { name: "GS_ASSETS", type: "r2", bucket_name: "gs-assets" },
      ...
    ],
    environment_variables: {
      ENV: "production",
      CLOUDFLARE_ACCESS_AUDIENCE: "8510d42c...",
      ...
    }
  }
```

### Compare Prod vs. Preview Routes
```
Tool: mcp__Cloudflare_Developer_Platform__workers_get_worker
Params:
  account_id: "f77de112d2019e5456a3198a8bb50bd2"
  worker_name: "gs-api"
  environment: "preview"

Result:
  {
    name: "gs-api",
    routes: [
      { pattern: "api-preview.goldshore.ai/*", zone_name: "goldshore.ai" },
      ...
    ],
    ...
  }

Diff:
  Prod:    api.goldshore.ai/*
  Preview: api-preview.goldshore.ai/*
  ✅ Correctly isolated
```

### Query Deployment Audit Log
```
Tool: mcp__Cloudflare_Developer_Platform__d1_database_query
Params:
  account_id: "f77de112d2019e5456a3198a8bb50bd2"
  database_id: "9703574e-adb7-481e-8d98-96f8ce5f8a90"
  sql: "SELECT * FROM audit_logs WHERE action = 'deployment' 
        ORDER BY timestamp DESC LIMIT 5"

Result:
  [
    {
      timestamp: "2026-08-09T18:45:00Z",
      action: "deployment",
      worker: "gs-api",
      environment: "prod",
      version: "v123",
      status: "success",
      duration_ms: 2300
    },
    ...
  ]
```

---

## Admin Dashboard Integration

### New Route: GET /admin/deployment-status

**Response:**
```json
{
  "prod": {
    "workers": {
      "gs-api": {
        "status": "active",
        "version": "v123",
        "deployed_at": "2026-08-09T18:45:00Z",
        "routes": ["api.goldshore.ai/*", ...],
        "bindings": {
          "KV": "e0b8b8...",
          "PLATFORM_DB": "9703574e...",
          "GS_ASSETS": "gs-assets"
        }
      },
      ...
    },
    "last_deploy": "2026-08-09T18:45:00Z"
  },
  "preview": {
    "workers": { ... },
    "last_deploy": "2026-08-08T14:20:00Z"
  }
}
```

**Page:** `/admin/deployment-status`
- Shows prod worker versions, routes, bindings
- Shows preview worker versions, routes, bindings
- Timeline of recent deployments (from D1 audit_logs)
- Health checks: KV accessible, D1 reachable, R2 responding

---

## GitHub Actions Integration

### Workflow: `verify-worker-deployment.yml`

Triggers on:
- Push to `main` (after merge)
- Manual trigger via workflow_dispatch

Steps:
1. Run `wrangler deploy --env prod --dry-run`
2. Use MCP tools to validate:
   - Bindings match wrangler.toml
   - Routes don't conflict with existing
   - Environment variables set correctly
3. If valid, run actual deploy: `wrangler deploy --env prod`
4. Verify deployed code matches commit SHA (hash source code)
5. Query D1 audit_logs to confirm deployment logged
6. Post deployment summary to Slack

---

## Troubleshooting

### Q: "Prod and preview out of sync"
**A:** Use MCP tools to compare:
```
Tool: mcp__Cloudflare_Developer_Platform__workers_get_worker
  - Fetch prod gs-api
  - Fetch preview gs-api
  - Diff routes, bindings, env vars
  - Report mismatches to admin dashboard
```

### Q: "Binding ID mismatch"
**A:** Query actual bindings via MCP:
```
Tool: mcp__Cloudflare_Developer_Platform__kv_namespaces_list
  - List all KV namespaces in account
  - Compare against wrangler.toml
  - Update wrangler.toml if ID changed
```

### Q: "Deployment stuck or failed"
**A:** Check audit logs:
```
Tool: mcp__Cloudflare_Developer_Platform__d1_database_query
  - Query audit_logs WHERE action='deployment' AND status='failed'
  - Show error details in admin dashboard
  - Recommend rollback or fix
```

### Q: "Preview routes not working"
**A:** Verify preview environment:
```
Tool: mcp__Cloudflare_Developer_Platform__workers_get_worker (env=preview)
  - Check if routes are configured
  - Verify bindings point to preview KV/D1 namespaces
  - Check if zone has preview subdomains
```

---

## Next Steps

1. ✅ Create `WORKERS_ENVIRONMENTS.json` (binding reference)
2. ✅ Implement `/admin/deployment-status` route in gs-api
3. ✅ Create GitHub Actions workflow for post-deploy validation
4. ✅ Add deployment status page to `/admin/deployment`
5. ✅ Document MCP query patterns in this file
6. ⏳ Integrate with Slack for deployment notifications
7. ⏳ Set up automated rollback on deployment failure

---

## See Also

- `infra/Cloudflare/BINDINGS_MAP.md` — Binding ID registry
- `infra/Cloudflare/desired-state.yaml` — Access policies
- `apps/gs-api/wrangler.toml` — Primary worker config
- `.github/workflows/` — Deployment automation
