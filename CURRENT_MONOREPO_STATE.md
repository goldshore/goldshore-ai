# Current GoldShore Monorepo State Snapshot

> [!NOTE]
> **Single source of truth for:** current top-level workspace layout and active application/package names.
> **Last updated:** 2026-03-23
> **Update basis:** filesystem inspection of `apps/`, `packages/`, `infra/`, and `.github/workflows`.

## Applications under `apps/`

The `apps/` directory currently contains **nine** top-level folders. Seven are the current `gs-*` applications, and two are compatibility/stale aliases that still exist on disk.

| Path | Package name | Type | Current state | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `apps/gs-web` | `@goldshore/gs-web` | Astro app | Active | Public website workspace |
| `apps/gs-admin` | `@goldshore/gs-admin` | Astro app | Active | Admin workspace |
| `apps/gs-api` | `@goldshore/gs-api` | Cloudflare Worker | Active | API service |
| `apps/gs-gateway` | `@goldshore/gs-gateway` | Cloudflare Worker | Active | Gateway / router service |
| `apps/gs-control` | `@goldshore/gs-control` | Cloudflare Worker | Active | Control-plane worker |
| `apps/gs-agent` | `@goldshore/gs-agent` | Cloudflare Worker | Active | Agent worker |
| `apps/gs-mail` | `@goldshore/gs-mail` | Cloudflare Worker | Active | Mail worker |
| `apps/web` | `@goldshore/web-compat` | Compatibility workspace | Stale alias still present | Keep clearly separate from `apps/gs-web`; not the canonical app path |
| `apps/admin` | `@goldshore/admin-compat` | Compatibility workspace | Stale alias still present | Keep clearly separate from `apps/gs-admin`; not the canonical app path |

## Shared packages under `packages/`

The `packages/` directory currently contains **eleven** top-level package folders:

| Path | Package name | Purpose |
| :--- | :--- | :--- |
| `packages/ai-providers` | `@goldshore/ai-providers` | AI provider integrations and adapters |
| `packages/auth` | `@goldshore/auth` | Shared auth helpers |
| `packages/brand` | `@goldshore/brand` | Brand assets/configuration |
| `packages/broker-adapters` | `@goldshore/broker-adapters` | Broker integration adapters |
| `packages/config` | `@goldshore/config` | Shared configuration |
| `packages/core-schema` | `@goldshore/core-schema` | Core schema definitions |
| `packages/integrations` | `@goldshore/integrations` | Shared integrations |
| `packages/schema` | `@goldshore/schema` | Shared schema package |
| `packages/theme` | `@goldshore/theme` | Theme tokens and styles |
| `packages/ui` | `@goldshore/ui` | Shared UI components |
| `packages/utils` | `@goldshore/utils` | Shared utilities |

## Infrastructure under `infra/`

The `infra/` directory currently contains these top-level entries:

| Path | Kind | Notes |
| :--- | :--- | :--- |
| `infra/AGENT_CANONICAL_STATE.json` | JSON state file | Agent canonical-state metadata |
| `infra/AI` | Directory | AI identity/config files |
| `infra/Cloudflare` | Directory | Cloudflare configuration, wrangler files, checks, and runbooks |
| `infra/cron` | Directory | Scheduled task helpers and cron scripts |
| `infra/github` | Directory | GitHub-related infra folder; `infra/github/workflows` currently contains only `.gitkeep` |
| `infra/scripts` | Directory | Repository/infrastructure scripts |

### `infra/Cloudflare` live files called out by name

- `infra/Cloudflare/gs-admin.wrangler.toml`
- `infra/Cloudflare/gs-agent.wrangler.toml`
- `infra/Cloudflare/gs-api.wrangler.toml`
- `infra/Cloudflare/gs-web.wrangler.toml`
- `infra/Cloudflare/config.yaml`
- `infra/Cloudflare/desired-state.yaml`
- `infra/Cloudflare/BINDINGS_MAP.md`
- `infra/Cloudflare/README.md`
- `infra/Cloudflare/checks.ts`
- `infra/Cloudflare/client.ts`
- `infra/Cloudflare/deploy.ts`
- `infra/Cloudflare/guards.ts`
- `infra/Cloudflare/tests.ts`
- `infra/Cloudflare/legacy/`
- `infra/Cloudflare/runbooks/`

## GitHub Actions workflows under `.github/workflows`

These workflow files currently exist in the repository root workflow directory:

- `archive-path-guard.yml`
- `canonical-structure-check.yml`
- `ci.yml`
- `cleanup-cache.yml`
- `cleanup-workflow-runs.yml`
- `close-stale-prs.yml`
- `deploy-gs-admin.yml`
- `deploy-gs-agent.yml`
- `deploy-gs-api.yml`
- `deploy-gs-control.yml.disabled`
- `deploy-gs-gateway.yml.disabled`
- `deploy-gs-mail.yml`
- `deploy-gs-web.yml`
- `jules-nightly.yml`
- `lockfile-guard.yml`
- `maintenance-gs-sync.yml`
- `maintenance.yml`
- `naming-guard.yml`
- `naming-lint.yml`
- `neuralegion.yml`
- `palette-manual.yml`
- `pii-scan.yml`
- `preview-gs-admin.yml`
- `preview-gs-agent.yml`
- `preview-gs-api.yml`
- `preview-gs-gateway.yml`
- `preview-gs-web.yml`
- `repo-health.yml`
- `route-collision-check.yml`
- `signed-commit-guard.yml`
- `sonarcloud.yml`
- `stabilization-task.yml`
- `summary.yml`
- `tfsec.yml`

## Explicit stale or removed references

The following names should be treated as stale references unless they appear in historical context:

- `apps/web` → stale compatibility path; canonical app path is `apps/gs-web`
- `apps/admin` → stale compatibility path; canonical app path is `apps/gs-admin`
- `apps/api-worker` → not present in the current `apps/` directory
- `apps/control-worker` → not present in the current `apps/` directory
- `apps/goldshore-agent` → not present in the current `apps/` directory
- `apps/jules-bot` → not present in the current `apps/` directory
- `apps/legacy/goldshore-api` → not present in the current `apps/` directory

## Workspace conventions

- Canonical application paths use the `gs-*` naming scheme.
- Cloudflare worker build settings should use the `gs-control` build token when build-token configuration is updated.
- Root workflow definitions live in `.github/workflows`; `infra/github/workflows` is not the active workflow directory today.
