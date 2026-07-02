# Cloudflare Wrangler Manifest Canonical Map

This directory previously contained both canonical `gs-*` Wrangler manifests and legacy `goldshore-*` variants.

## Inventory: legacy `goldshore-*.wrangler.toml`

The following legacy manifests were moved to `infra/Cloudflare/legacy/` and are **non-deployable references**:

- `goldshore-admin.wrangler.toml`
- `goldshore-api.wrangler.toml`
- `goldshore-web.wrangler.toml`

## Canonical Wrangler manifest path per live service

Use exactly one canonical path per live service:

| Service       | Canonical manifest path          |
| ------------- | -------------------------------- |
| `gs-web`      | `apps/gs-web/wrangler.toml`      |
| `gs-admin`    | `apps/gs-admin/wrangler.toml`    |
| `gs-api`      | `apps/gs-api/wrangler.toml`      |
| `gs-gateway`  | `apps/gs-gateway/wrangler.toml`  |
| `gs-control`  | `apps/gs-control/wrangler.toml`  |
| `gs-mail`     | `apps/gs-mail/wrangler.toml`     |
| `gs-agent`    | `apps/gs-agent/wrangler.toml`    |
| `gs-trading`  | `apps/gs-trading/wrangler.toml`  |
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

| Secret name                  | Required for                                                | Ownership                                       |
| ---------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`      | All worker deploy jobs and Cloudflare infra guard checks    | Cloudflare account owner / platform ops         |
| `CLOUDFLARE_ZONE_ID`         | DNS and zone-scoped Cloudflare helper checks                | Cloudflare zone owner / platform ops            |
| `CLOUDFLARE_BUILD_API_TOKEN` | All worker deploy jobs and Cloudflare infra guard API calls | `gs-control` service token owner / platform ops |

Policy:

- `CLOUDFLARE_BUILD_API_TOKEN` is the single canonical deploy token secret for worker CI.
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_ZONE_ID` are the canonical account/zone identifiers for Cloudflare helper scripts.
- Do not add fallback expressions such as `secretA || secretB` in worker deploy workflows unless a documented exception is added to Cloudflare runbooks.

Migration behavior:

- Cloudflare helper scripts read canonical env names first: `CLOUDFLARE_BUILD_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_ZONE_ID`.
- For compatibility with local/runtime tooling, workflows may also map canonical secrets into aliases: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, and `CF_ZONE_ID`. `CF_API_TOKEN` is only an alias for `CLOUDFLARE_BUILD_API_TOKEN`, not a separate token source.
- If older tooling still references `CLOUDFLARE_API_TOKEN`, migrate by updating that tooling to set runtime env `CLOUDFLARE_API_TOKEN` from `secrets.CLOUDFLARE_BUILD_API_TOKEN` in CI.
- Do not add `||` fallbacks in workflow env blocks.
- Temporary compatibility, if required, must be managed by workflow env mapping from canonical secrets and a tracked removal task.
