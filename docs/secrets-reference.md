# Repository Secrets Reference

Add or update these secrets at the links below. Never commit values to git.

---

## goldshore-ai

**Settings → Secrets:** https://github.com/marzton/goldshore-ai/settings/secrets/actions

| Secret Name | What it is | Where to get it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (read/write Workers, D1, KV, R2) | https://dash.cloudflare.com/profile/api-tokens |
| `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN` | Cloudflare deploy token scoped to goldshore-ai Workers | https://dash.cloudflare.com/profile/api-tokens |
| `GOOGLE_CHAT_WEBHOOK` | Google Chat space webhook URL for CI notifications | chat.google.com → Space → Apps & integrations → Webhooks |
| `GOOGLE_CLIENT_ID` | GCP OAuth 2.0 client ID | https://console.cloud.google.com/apis/credentials |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token | https://ads.google.com/aw/apicenter |
| `GH_PAT` | GitHub PAT with `repo` + `workflow` scopes (branch protection) | https://github.com/settings/tokens |

---

## goldshore-gateway

**Settings → Secrets:** https://github.com/marzton/goldshore-gateway/settings/secrets/actions

| Secret Name | What it is | Where to get it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (same token as goldshore-ai is fine) | https://dash.cloudflare.com/profile/api-tokens |
| `GOOGLE_CHAT_WEBHOOK` | Same webhook URL as goldshore-ai | chat.google.com → Space → Apps & integrations → Webhooks |

---

## Notes

- `CLOUDFLARE_API_TOKEN` in goldshore-gateway is currently expired — renewing it unblocks PR #213 CI checks (`verify-cloudflare`, `verify-account-resources`).
- `GOOGLE_ADS_DEVELOPER_TOKEN` — rotate the previous token before adding (prior value was shared in chat).
- GCP service account key (`github-storage-access`) — revoke the old key at https://console.cloud.google.com/iam-admin/serviceaccounts → `github-storage-access` → Manage Keys before creating a new one.
- `GOOGLE_CHAT_WEBHOOK` must exist in both repos before the Monday 9am UTC reminder fires.
