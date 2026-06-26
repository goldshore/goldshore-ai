# Cloudflare Wrangler Manifest Canonical Map

This directory previously contained both canonical `gs-*` Wrangler manifests and legacy `goldshore-*` variants.

## Inventory: legacy `goldshore-*.wrangler.toml`

The following legacy manifests were moved to `infra/Cloudflare/legacy/` and are **non-deployable references**:

- `goldshore-admin.wrangler.toml`
- `goldshore-api.wrangler.toml`
- `goldshore-web.wrangler.toml`

## Canonical Wrangler manifest path per live service

Use exactly one canonical path per live service:

| Service | Canonical manifest path |
|---|---|
| `gs-web` | `apps/gs-web/wrangler.toml` |
| `gs-admin` | `apps/gs-admin/wrangler.toml` |
| `gs-api` | `apps/gs-api/wrangler.toml` |
| `gs-gateway` | `apps/gs-gateway/wrangler.toml` |
| `gs-control` | `apps/gs-control/wrangler.toml` |
| `gs-mail` | `apps/gs-mail/wrangler.toml` |
| `gs-agent` | `apps/gs-agent/wrangler.toml` |
| `gs-trading` | `apps/gs-trading/wrangler.toml` |
| `banproof-me` | `apps/banproof-me/wrangler.toml` |
| `armsway-com` | `apps/armsway-com/wrangler.toml` |

The `infra/Cloudflare/*.wrangler.toml` files are infra mirrors/references. Production tooling should prefer app-local manifests unless a runbook explicitly says otherwise.

## Routing source of truth

For Pages-vs-Workers route ownership and change workflow rules, use:

- `docs/architecture/domain-ownership.md`
- `docs/architecture/cloudflare-deploy-checklist.md`
- `docs/architecture/cloudflare-live-cleanup.md`
- `infra/Cloudflare/runbooks/ROUTING_SOURCE_OF_TRUTH.md`

## Selection policy

Do **not** glob `infra/Cloudflare/*.wrangler.toml` in scripts/docs. Use explicit canonical paths.

## CI Secret Contract (Canonical)

Cloudflare worker deploy workflows and infra guard checks use the following canonical GitHub Actions secrets:

| Secret name | Required for | Ownership |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | All worker deploy jobs and Cloudflare infra guard checks | Cloudflare account owner / platform ops |
| `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN` | Deploy jobs for Cloudflare resources owned by `marzton/goldshore-ai` | `goldshore-ai` service owner / platform ops |

Policy:

- `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN` is the canonical deploy token secret for this repository; it must be scoped only to the Workers, Pages projects, Queues, Workflows, and zones deployed from `marzton/goldshore-ai`.
- Do not add fallback expressions such as `secretA || secretB` in worker deploy workflows unless a documented exception is added to Cloudflare runbooks.

Migration behavior:

- If older tooling still references `CLOUDFLARE_API_TOKEN`, migrate by updating that tooling to set runtime env `CLOUDFLARE_API_TOKEN` from `secrets.CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN` in CI.
- Do not add `||` fallbacks in workflow env blocks.
- Temporary compatibility, if required, must be managed in secret administration with mirrored secret values and a tracked removal task.

Repository token boundary:

- Keep the mother/build repository token (`CLOUDFLARE_GOLDSHORE_BUILD_TOKEN` for `marzton/goldshore`) out of this repository.
- Remove broad or legacy app-repo secrets such as `CLOUDFLARE_BUILD_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, and `CF_WORKERS_BUILDS` after the repository-specific deploy token is installed.
- Do not grant this repository token account-wide edit access; grant only the zones, Workers, Pages projects, Queues, and Workflows documented above.
