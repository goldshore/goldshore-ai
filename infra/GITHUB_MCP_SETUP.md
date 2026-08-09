# GitHub MCP Servers Configuration

> Last Updated: 2026-08-09  
> Location: Settings → Copilot → MCP servers  
> Config File: `.github/mcp-servers.json`

---

## Overview

This document describes the MCP (Model Context Protocol) servers registered for the goldshore-ai repository. These servers enable Copilot, Claude, and other AI agents to query Cloudflare infrastructure, GitHub metadata, and documentation directly from GitHub repository settings.

---

## MCP Servers Registered

### 1. Cloudflare Developer Platform (`cloudflare`)

**Purpose:** Query Cloudflare Workers, bindings, KV namespaces, D1 databases, R2 buckets, and deployment status.

**Account ID:** `f77de112d2019e5456a3198a8bb50bd2` (Gold Shore Labs)

**Available Tools:**
- `workers_list` — List all workers (prod/preview)
- `workers_get_worker` — Get worker details, routes, bindings, env vars
- `workers_get_worker_code` — Fetch deployed worker source code
- `kv_namespaces_list` — List all KV namespaces with sizes
- `d1_databases_list` — List D1 databases and tables
- `d1_database_query` — Execute SQL queries (SELECT only by default)
- `r2_buckets_list` — List R2 buckets and object counts

**Environment Variables Required:**
```
CLOUDFLARE_API_TOKEN=<your-api-token>
CLOUDFLARE_EMAIL=<your-email>
CLOUDFLARE_API_KEY=<your-global-api-key>
```

**Setup Instructions:**
1. Go to https://github.com/marzton/goldshore-ai/settings/copilot/mcp_servers
2. Paste the JSON configuration from `.github/mcp-servers.json`
3. Set repository secrets for `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_API_KEY`
4. Click "Save MCP configuration"

---

### 2. GitHub MCP Server (`github`)

**Purpose:** Manage issues, PRs, branches, commits, and deployment workflows.

**Available Tools:**
- `list_issues` — List all issues with filtering
- `search_issues` — Search issues by title, label, state
- `list_pull_requests` — List all PRs with filtering
- `create_pull_request` — Create a new PR
- `pull_request_read` — Get PR details, reviews, commits
- `pull_request_review_write` — Create/submit PR reviews
- `create_branch` — Create a new branch from base
- `list_commits` — List commits with filtering
- `push_files` — Push commits to a branch (requires approval)

**Environment Variables Required:**
```
GITHUB_TOKEN=<your-github-token>
```

**Token Permissions Needed:**
- `repo` (full control of private/public repositories)
- `workflow` (read/write GitHub Actions workflows)
- `admin:repo_hook` (manage webhooks)
- `admin:org_hook` (manage organization webhooks)

**Setup Instructions:**
1. Create a GitHub Personal Access Token (Classic or Fine-grained)
2. Go to https://github.com/marzton/goldshore-ai/settings/secrets/actions
3. Add secret: `GITHUB_TOKEN=<your-token>`
4. MCP configuration in Copilot settings will auto-detect this

---

### 3. Anthropic Documentation (`anthropic-docs`)

**Purpose:** Access Claude API documentation, model info, pricing, and prompt caching details.

**Available Tools:**
- `search_docs` — Search Anthropic documentation
- `get_model_info` — Get model IDs, capabilities, token limits
- `get_pricing` — Get current pricing for models
- `get_token_limits` — Get context window and token limits

**No authentication required** — This is public documentation.

**Setup Instructions:**
1. No secrets required
2. Configuration is automatic in `.github/mcp-servers.json`

---

### 4. Wrangler Documentation (`wrangler-docs`)

**Purpose:** Query Cloudflare Workers documentation, Wrangler CLI syntax, and configuration schema.

**Available Tools:**
- `search_wrangler_docs` — Search Wrangler documentation
- `get_wrangler_config_schema` — Get wrangler.toml schema validation

**No authentication required** — This is public documentation.

**Setup Instructions:**
1. No secrets required
2. Configuration is automatic in `.github/mcp-servers.json`

---

## Agent Permissions & Restrictions

### Allowed Tools (no approval required)
- `cloudflare:workers_list` — Query worker status
- `cloudflare:workers_get_worker` — Get worker config
- `cloudflare:kv_namespaces_list` — List KV stores
- `cloudflare:d1_databases_list` — List databases
- `github:list_issues` — Search issues
- `github:list_pull_requests` — Search PRs
- `github:create_branch` — Create feature branch

### Restricted Tools (read-only, no deletions)
- `cloudflare:workers_*_delete` — ❌ Cannot delete workers
- `github:push_files` — ⚠️ Requires approval
- `github:delete_file` — ❌ Cannot delete files

### Tools Requiring Approval (dangerous operations)
- `cloudflare:d1_database_query` — SQL queries (INSERT/UPDATE/DELETE)
- `github:push_files` — Commit and push to branches
- `github:create_pull_request` — Create PRs (must be reviewed)

---

## Usage Examples

### Query Production Worker Status
```
mcp__Cloudflare_Developer_Platform__workers_list
  account_id: "f77de112d2019e5456a3198a8bb50bd2"
  
Response: [
  {
    id: "gs-api-prod-v456",
    name: "gs-api",
    environment: "production",
    status: "active",
    routes: ["api.goldshore.ai/*", ...],
    modified_on: "2026-08-09T18:45:00Z"
  },
  ...
]
```

### Verify Prod Bindings
```
mcp__Cloudflare_Developer_Platform__workers_get_worker
  account_id: "f77de112d2019e5456a3198a8bb50bd2"
  worker_name: "gs-api"
  environment: "prod"

Response: {
  routes: [...],
  bindings: [
    { name: "KV", type: "kv_namespace", id: "e0b8b807..." },
    { name: "PLATFORM_DB", type: "d1", database_id: "9703574e..." },
    { name: "GS_ASSETS", type: "r2", bucket_name: "gs-assets" },
    ...
  ],
  environment_variables: { ... }
}
```

### Search GitHub Issues
```
mcp__github__search_issues
  owner: "marzton"
  repo: "goldshore-ai"
  query: "label:audit severity:critical state:open"

Response: Issues matching [audit] label with critical severity
```

---

## Deployment Audit Workflow

The MCP servers enable automated deployment verification:

1. **Pre-deployment** (via GitHub Actions):
   - Query current worker version via `workers_get_worker`
   - Verify binding IDs match `wrangler.toml`
   - List D1 tables to ensure schema is compatible

2. **Deploy** (wrangler CLI):
   ```
   wrangler deploy --env prod
   ```

3. **Post-deployment** (via MCP):
   - Get new worker version (compare code hash)
   - Verify routes are active
   - Query D1 audit_logs table to confirm deployment logged

4. **Monitoring** (periodic checks):
   - Every 5 min: Check worker health
   - Every hour: Verify bindings match config
   - Every day: Compare deployed vs. repo versions

---

## Repository Secrets (GitHub Settings → Secrets)

Add these to `https://github.com/marzton/goldshore-ai/settings/secrets/actions`:

```
CLOUDFLARE_API_TOKEN=<api-token-from-cloudflare-dashboard>
CLOUDFLARE_EMAIL=<your-cloudflare-email>
CLOUDFLARE_API_KEY=<global-api-key-from-cloudflare>
GITHUB_TOKEN=<personal-access-token>
```

**Never commit these to git.** They are only used by GitHub Actions and MCP tools.

---

## Next Steps

1. ✅ **MCP servers configuration** (this file)
2. ⏳ **Deploy keys & environment secrets** (prod/preview)
3. ⏳ **Branch protection rules** (main branch)
4. ⏳ **GitHub Actions workflow** (verify-worker-deployment.yml)
5. ⏳ **Admin dashboard routes** (/admin/deployment-status)

---

## See Also

- `infra/Cloudflare/WORKERS_DEPLOYMENT_CONFIG.md` — Worker inventory and MCP tool mappings
- `infra/Cloudflare/WORKERS_ENVIRONMENTS.json` — Prod/preview environment structure
- `apps/gs-api/wrangler.toml` — Worker configuration source of truth
- `.github/workflows/` — GitHub Actions CI/CD workflows
