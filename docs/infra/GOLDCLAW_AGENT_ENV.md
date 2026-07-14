# GoldClaw Agent Environment

Merge Strategy: Merge Commit

GoldClaw agent work starts from the GoldShore repo root:

```powershell
E:\OneDrive\Documents\goldshore-ai
```

Do not run GoldShore implementation work from:

```powershell
C:\Users\marst\.claude
```

That directory is Claude's home/config store. It is not the source of truth for
GoldShore code, manifests, MCP configuration, or secret-name contracts.

## Start Claude In The Correct Workspace

From Claude's current terminal:

```powershell
cd C:\Users\marst\.claude
.\goldshore.ps1 -StartSecretSyncApp -StartClaude
```

or:

```powershell
cd C:\Users\marst\.claude
.\goldshore.cmd -StartSecretSyncApp -StartClaude
```

From inside the repo:

```powershell
pnpm goldclaw:agent-env
```

The bootstrap sets the terminal location to the repo root, publishes GoldShore
endpoint environment variables, fetches `origin/main`, checks GitHub and
Wrangler auth, runs the secret-name guard, and reports local runtime-vault key
presence without printing values. It also reports the VS Code Remote Tunnel
state for mobile/remote IDE access.

It only fast-forwards `main` when explicitly requested and safe:

```powershell
.\goldshore.ps1 -PullMainIfClean
```

The script will not pull over a dirty tree or merge `main` into a feature
branch.

## Pixel Fold / Android IDE Access

The laptop is configured for VS Code Remote Tunnels as:

```text
laptop-treb
```

Use this from Chrome on the Google Pixel Fold:

```text
https://vscode.dev/tunnel/laptop-treb
```

Sign in with the same GitHub account that owns the laptop tunnel, then open:

```text
E:\OneDrive\Documents\goldshore-ai
```

Current tunnel checks:

```powershell
code tunnel status
code tunnel user show
```

Expected state:

```text
tunnel=Connected
service_installed=true
provider=GitHub Account
```

The tunnel should remain available while the laptop is awake and connected. If
it ever stops, restart it with:

```powershell
code tunnel restart
```

Do not expose the local Secret Sync app (`127.0.0.1:8798`) through a public
anonymous tunnel. If phone access to that app is needed, put it behind
Cloudflare Access or use the authenticated VS Code tunnel session.

## Canonical Local Files

- `AGENTS.md`: architecture and agent rules.
- `.mcp.json`: project MCP server list for Claude-compatible clients.
- `.claude/settings.json`: project Claude permissions and session hook.
- `infra/secrets/secret-sync.manifest.yaml`: canonical secret-name contract.
- `scripts/sync-secrets.mjs`: audit/apply engine for secret propagation.
- `scripts/secret-sync-app.mjs`: local browser app for OAuth, SSO, and sync.
- `scripts/check-cloudflare-agent-access.mjs`: local-only Cloudflare API
  access verifier for Codex/Claude.
- `apps/gs-api/src/routes/goldclaw.ts`: GoldClaw API surface.
- `apps/gs-web/src/pages/admin/goldclaw.astro`: GoldClaw admin surface.
- `docs/infra/CLOUDFLARE_AGENT_ACCESS.md`: exact Cloudflare token scope and
  verification runbook.

## Domain Responsibilities

| Host | Purpose |
| --- | --- |
| `mcp.goldshore.ai` | Remote MCP endpoint for approved AI agents. Expose GoldShore tools, not raw unmanaged provider control. |
| `mcp.atlassian.com/v1/mcp/authv2` | Atlassian Rovo MCP endpoint for Jira, Confluence, Compass, and Rovo tools. Use this endpoint for desktop/IDE MCP clients; do not use the retired `/v1/sse` path. |
| `api.goldshore.ai` | Unified API Worker routes, OAuth callbacks, secret-sync audit endpoints, and GoldClaw backend logic. |
| `admin.goldshore.ai` | Human admin UI and approval cockpit. |
| `dash.goldshore.ai` | Dashboard/operations surface for business and trading workflows. |
| `agent.goldshore.ai` | Agent runtime/orchestration/status traffic. Do not use as the general MCP endpoint. |

## Monorepo Boundary

Current agent instruction is the two-app monorepo:

- `apps/gs-web`
- `apps/gs-api`

Do not create a new worker app for GoldClaw MCP work. If `mcp.goldshore.ai`
needs implementation changes, route them through `apps/gs-api`, for example:

```text
apps/gs-api/src/routes/mcp.ts
apps/gs-api/src/routes/goldclaw.ts
```

Older docs may mention `apps/gs-mcp`. Treat those references as historical
until the architecture rule changes explicitly.

## Secret And Provider Rules

- Secret names and targets live in `infra/secrets/secret-sync.manifest.yaml`.
- Secret values stay in environment variables, ignored local vault files, or
  controlled provider stores.
- Run `node scripts/sync-secrets.mjs check` after manifest/name changes.
- Use the local app for Cloudflare SSO, OAuth client IDs, GitHub OAuth client
  IDs, and verified token fallback.
- New Cloudflare token fallback values must verify active before overwriting
  local runtime token values.
- High-privilege Cloudflare operator access uses
  `CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN` locally and is checked with
  `pnpm cf:agent-access`. It is intentionally not synced into GitHub Actions or
  Cloudflare Workers.
- GitHub writes default to GitHub CLI keyring auth, not a saved `GH_TOKEN`.

## MCP Tool Policy

GoldShore MCP should expose policy-aware tools such as:

- `secret_sync.audit`
- `secret_sync.dry_run`
- `secret_sync.apply_requires_approval`
- `manifest.validate`
- `goldclaw.provider_status`
- `cloudflare.access_app_status`
- `cloudflare.zero_trust_plan`

Raw destructive actions such as DNS edits, Worker deploys, Access policy
changes, token rotations, campaign spend, publishing, refunds, or customer
messages must require explicit human approval and audit logging.
