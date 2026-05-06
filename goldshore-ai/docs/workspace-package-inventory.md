# Workspace package inventory and consolidation

This inventory is sourced from:

- `pnpm-workspace.yaml`
- `apps/*/package.json`
- `packages/*/package.json`

## Workspace globs

- `apps/*`
- `packages/*`
- `infra/*`

## Apps

| Package | Path | Exports | Domain / route ownership |
| --- | --- | --- | --- |
| `@goldshore/gs-admin` | `apps/gs-admin` | none | Admin web UI surfaces for ops, monetization, users, media, system status. |
| `@goldshore/gs-agent` | `apps/gs-agent` | none | Agent worker endpoints (`/`, `/health`). |
| `@goldshore/gs-api` | `apps/gs-api` | none | Primary API surface and route modules (`/users`, `/health`, `/ai`, `/user`, `/system`, `/templates`, `/admin`, `/media`, `/pages`). |
| `@goldshore/gs-control` | `apps/gs-control` | none | Cloudflare control-plane orchestration (`/dns/*`, `/workers/*`, `/pages/*`, `/access/*`, `/cloudflare/*`). |
| `@goldshore/gs-gateway` | `apps/gs-gateway` | none | API gateway, edge auth guard, and forwarding/proxy ownership. |
| `@goldshore/gs-web` | `apps/gs-web` | none | Public website application, content pages, templates and web UX. |
| `@goldshore/gs-mail` | `apps/gs-mail` | none | Mail ingestion worker. |

## Shared packages

| Package | Path | Exports |
| --- | --- | --- |
| `@goldshore/ai-providers` | `packages/ai-providers` | none |
| `@goldshore/auth` | `packages/auth` | none |
| `@goldshore/config` | `packages/config` | `./astro`, `./middleware`, `./env`, `./scaffold` |
| `@goldshore/integrations` | `packages/integrations` | none |
| `@goldshore/theme` | `packages/theme` | `.`, `./tokens`, `./styles/tokens`, `./styles/base`, `./styles/components`, `./styles/layout`, `./manager`, `./assets/logo.svg` |
| `@goldshore/ui` | `packages/ui` | `.` |
| `@goldshore/utils` | `packages/utils` | `.` |

## Duplicate feature areas and ownership decisions

### 1) Gateway auth wrapper duplicated shared auth logic

- Duplicate area:
  - `apps/gs-gateway/src/auth.ts` only proxied `verifyAccess` from `@goldshore/auth`.
- Owner package:
  - `@goldshore/auth` remains canonical owner for Access verification.
- Migration:
  - `apps/gs-gateway/src/index.ts` now imports `verifyAccess` directly from `@goldshore/auth`.
  - Removed `apps/gs-gateway/src/auth.ts`.

### 2) UI button behavior duplicated in two component implementations

- Duplicate area:
  - `packages/ui/GSButton.astro` and `packages/ui/components/Button.astro` both implemented button rendering logic with overlapping variants.
- Owner package/file:
  - `packages/ui/GSButton.astro` designated as implementation owner.
- Migration:
  - `packages/ui/components/Button.astro` converted to a compatibility wrapper over `GSButton`.
  - Existing `Button` consumers can keep legacy `kind` and `size` props; wrapper maps to owner behavior.

### 3) Orphan package

- Removed orphan:
  - `packages/schema` (`@astro-gs/schema`) had no live references in `apps/*` or `packages/*` runtime code.
- Migration impact:
  - No import rewrites required in active apps; references only existed in legacy snapshots/logs.

