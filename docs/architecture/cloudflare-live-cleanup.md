# Live Cloudflare Cleanup Runbook

Last updated: 2026-06-15

This runbook covers the live Cloudflare changes that cannot be completed from GitHub repo edits alone.

## Goal

Make `marzton/goldshore-ai` the source of truth for Cloudflare Pages and Workers deployments.

## Custom domain cleanup

In Cloudflare Dashboard:

1. Go to Workers & Pages.
2. Check any Worker named `goldshore-ai`, `gs-platform`, `gs-dynamic-worker`, or old `goldshore-org`.
3. Remove custom-domain bindings that conflict with the canonical map.
4. Ensure these final owners:

| Hostname / route | Owner |
|---|---|
| `goldshore.ai` | `gs-web` Pages |
| `www.goldshore.ai` | `gs-web` Pages |
| `goldshore.org` | `gs-web` Pages |
| `www.goldshore.org` | `gs-web` Pages |
| `api.goldshore.ai/*` | `gs-api` Worker |
| `gw.goldshore.ai/*` | `gs-gateway` Worker |
| `agent.goldshore.ai/*` | `gs-gateway` Worker |
| `admin.goldshore.ai` | `gs-admin` Pages + Access |
| `rmarston.com` | `rmarston-com`, not `gs-web` |

## Worker name cleanup

Preferred canonical worker name:

```text
gs-gateway
```

Prior audits observed a live worker named:

```text
gs-platform
```

Pick one. The repo currently standardizes on `gs-gateway`; the preferred cleanup is to retire or rename the live `gs-platform` Worker and deploy `gs-gateway` from this monorepo.

## D1 migrations

Run after confirming Cloudflare credentials:

```bash
wrangler d1 execute gs_platform_db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
wrangler d1 execute gs_audit_db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

If either returns no tables, apply the repo migrations for that database before enabling dependent routes.

## Final smoke tests

```bash
curl -I https://goldshore.ai
curl -I https://www.goldshore.ai
curl -I https://goldshore.org
curl -I https://www.goldshore.org
curl -I https://api.goldshore.ai/health
curl -I https://gw.goldshore.ai/health
curl -I https://admin.goldshore.ai
```

Success criteria:

- Public website domains resolve through `gs-web`.
- API route resolves through `gs-api`.
- Gateway route resolves through `gs-gateway`.
- Admin route is protected by Cloudflare Access.
