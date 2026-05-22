# Gateway KV Sync (`sync:infra`)

Use `sync:infra` to validate and upload the canonical gateway control keys to Cloudflare KV:

- `ROUTING_TABLE`
- `SERVICE_STATUS`
- `AI_ORCHESTRATION`
- `INFRA_SYNC_LEDGER` (sync metadata + last-run timestamp)

## Required environment variables

- `CLOUDFLARE_API_TOKEN` (**required**)
- `CLOUDFLARE_ACCOUNT_ID` (optional if `CF_ACCOUNT_ID` is available)
- `GS_KV_NAMESPACE_ID` (optional if default repo namespace is acceptable)

## Token scopes

Create a Cloudflare API token with at least:

- `Account > Workers KV Storage > Edit`
- `Account > Account Settings > Read` (recommended for account-level introspection/debug)

Scope it to the target account and namespace used by GoldShore production.

## Usage

```bash
CLOUDFLARE_API_TOKEN=*** \
CLOUDFLARE_ACCOUNT_ID=*** \
GS_KV_NAMESPACE_ID=*** \
pnpm sync:infra
```

The script prints per-key upload status and then checks:

- `https://api.goldshore.ai/internal/inbox-status`

A non-zero exit code is returned if any KV upload fails or verification fails.
