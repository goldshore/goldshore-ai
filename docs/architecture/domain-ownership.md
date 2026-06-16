# Domain Ownership

Last updated: 2026-06-15

This file is the canonical human-readable route ownership policy for GoldShore Cloudflare Pages and Workers deployments.

## Canonical owners

| Domain / route | Owner | Cloudflare type | Purpose |
|---|---|---|---|
| `goldshore.ai` | `gs-web` | Pages | Public website |
| `www.goldshore.ai` | `gs-web` | Pages | Public website alias |
| `goldshore.org` | `gs-web` | Pages | Monorepo-owned org/legacy domain |
| `www.goldshore.org` | `gs-web` | Pages | Org/legacy alias |
| `api.goldshore.ai/*` | `gs-api` | Worker | API surface |
| `gw.goldshore.ai/*` | `gs-gateway` | Worker | Gateway surface |
| `agent.goldshore.ai/*` | `gs-gateway` | Worker | Agent-facing gateway route |
| `admin.goldshore.ai` | `gs-admin` | Pages + Cloudflare Access | Admin UI |
| `admin-preview.goldshore.ai` | `gs-admin` | Pages + Cloudflare Access | Admin preview UI |
| `ops.goldshore.ai/*` | `gs-control` | Worker | Control plane |
| `mail.goldshore.ai/*` | `gs-mail` | Worker | Mail/events worker |
| `rmarston.com` | `rmarston-com` | Separate repo/project | Personal site |

## Rules

1. One hostname or wildcard route has one owner.
2. Pages owns public websites and admin frontends.
3. Workers own API, gateway, control, mail, and backend routes.
4. `gs-gateway` must not claim `api.goldshore.ai/*`; that route belongs to `gs-api`.
5. `gs-web` must not claim `rmarston.com`; that domain belongs to the standalone `rmarston-com` path.
6. `goldshore-org` is not canonical while `goldshore.org` is owned by `gs-web` in this monorepo.

## Deployment source of truth

The source repo is:

```text
marzton/goldshore-ai
```

Primary app configs:

```text
apps/gs-web/wrangler.toml
apps/gs-admin/wrangler.toml
apps/gs-api/wrangler.toml
apps/gs-gateway/wrangler.toml
apps/gs-control/wrangler.toml
apps/gs-mail/wrangler.toml
apps/gs-agent/wrangler.toml
apps/gs-trading/wrangler.toml
apps/banproof-me/wrangler.toml
apps/armsway-com/wrangler.toml
```

Infra mirror configs under `infra/Cloudflare/` are references and must stay aligned with app-local configs.

## Live Cloudflare cleanup checklist

- Remove any old `goldshore-ai` stub Worker custom-domain binding for `goldshore.ai`.
- Remove any `gs-dynamic-worker` test route/domain binding.
- Ensure `gs-web` Pages owns `goldshore.ai`, `www.goldshore.ai`, `goldshore.org`, and `www.goldshore.org`.
- Ensure `gs-api` Worker owns `api.goldshore.ai/*`.
- Ensure `gs-gateway` Worker owns `gw.goldshore.ai/*` and `agent.goldshore.ai/*` only.
- Ensure `rmarston.com` is not attached to `gs-web`.
