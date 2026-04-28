# Current GoldShore Monorepo State Snapshot

> [!NOTE]
> **Document metadata**
> - **Single source of truth for:** architecture and repository state
> - **Last updated:** 2026-02-11
> - **Updated by:** manual
> - **Workflow update path:** `N/A` (manual-only updates at this time)
> - **Repository layout invariant:** This `goldshore-ai/` directory is the single monorepo root; nested `goldshore-ai/` directories that themselves contain `apps/`, `.github/`, or config trees are considered accidental and must be removed rather than committed.

## Active Workspaces

| Workspace | Package Name | Type | Status | Goal |
| :--- | :--- | :--- | :--- | :--- |
| `apps/gs-web` | `@goldshore/web` | Astro (SSR) | Active | Public marketing site |
| `apps/gs-admin` | `@goldshore/admin` | Astro (SSR) | Active | Secure operational console |
| `apps/gs-api` | `gs-api` | Worker | Active | Core API logic |
| `apps/gs-gateway` | `@goldshore/gateway` | Worker (Hono) | Active | API Gateway / Router |
| `apps/gs-control` | `@goldshore/control` | Worker (Hono) | Active | Control plane logic |
| `apps/gs-agent` | `@goldshore/agent` | Worker (Hono) | Active | Canonical AI agent service |
| `apps/goldshore-agent` | `goldshore-agent` | Worker (Hono) | Deprecated | Legacy shim kept in sync with `gs-agent` |
| `apps/jules-bot` | `jules-bot` | Archived | Archived | Bot logic (removed in restructuring) |

## Legacy / Archive

- `apps/legacy/goldshore-api`

## Infrastructure

- `infra/scripts`: Automation scripts
- `infra/cloudflare`: Cloudflare configurations (wrangler.toml files for some apps are here or referenced)

## Configuration Summary

- **Package Manager**: pnpm (v9)
- **Monorepo Tool**: Turbo
- **Linting**: ESLint (root `.eslintrc.cjs` + workspace extensions)
- **Styling**: TailwindCSS
- **Frameworks**: Astro, Hono, Cloudflare Workers

## Recent Updates
- Reconciled the agent worker so `apps/gs-agent` is the single active implementation, with `apps/goldshore-agent` retained as a legacy shim.

- **February 2026**: Completed major directory restructuring renaming apps to use `gs-` prefix (gs-web, gs-admin, gs-api, gs-control, gs-gateway) for brand consistency
- Reconciled the agent worker so `apps/gs-agent` is the single active implementation, with `apps/goldshore-agent` retained as a legacy shim
- Consolidated Astro configuration and fixed package issues across monorepo
