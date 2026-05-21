# Cloudflare Binding and DNS Matrix

## Inputs and limitations
- DNS source file `docs/infrastructure/dns-zone-2026-04-28.txt` was not present in this repository snapshot, so DNS “actual” values below are taken from the sprint brief and marked as **unverified in repo**.
- Cloudflare CLI inventory commands are captured in `docs/infrastructure/cf-inventory-snapshot.md`; `wrangler` was unavailable in this environment.

## Route + binding matrix

| subdomain/pattern | expected worker/project | actual route registered (wrangler) | binding name | binding source | env var name | secret name | CI input/output |
|---|---|---|---|---|---|---|---|
| `goldshore.ai/*` | `gs-platform-legacy` (formerly `gs-gateway`) | yes (`apps/gs-gateway/wrangler.toml`) | `SECURITY`, `SIGNALS`, `MAIL_QUEUE`, `DB`, `ASSETS`, `AI_CACHE`, `GS_CONFIG`, `GATEWAY_KV` | Worker config (`env.prod.*`) | `ENV`, `CLOUDFLARE_TEAM_DOMAIN` | none declared in file | Deploy workflow not resolved in this task |
| `www.goldshore.ai/*` | `gs-platform-legacy` | yes | same as above | same | same | same | same |
| `gw.goldshore.ai/*` | `gs-platform-legacy` | yes | same as above | same | same | same | same |
| `agent.goldshore.ai/*` | `gs-platform-legacy` | yes | same as above | same | same | same | same |
| `api.goldshore.ai/*` | `gs-api` | yes (`apps/gs-api/wrangler.toml`) | `KV`, `CONTROL_LOGS`, `ASSETS`, `DB`, `AI`, `TELEMETRY_DB`, `AUTH_SESSION` | Worker config (`env.prod.*`) | `ENV`, `CLOUDFLARE_ACCESS_AUDIENCE`, `CLOUDFLARE_TEAM_DOMAIN`, `CONTROL_SYNC_TOKEN` | `CONTROL_SYNC_TOKEN` placeholder in config | Deploy workflow not resolved in this task |
| `admin.goldshore.ai/*` | `gs-admin` (Pages project) | no worker route in wrangler (Pages project only) | `KV`, `DB`, `ASSETS`, `API_SERVICE` | Pages Functions wrangler bindings | `ENV`, `CLOUDFLARE_TEAM_DOMAIN`, `CLOUDFLARE_ACCESS_AUDIENCE` | `ADMIN_API_KEY` (commented setup) | Deploy workflow not resolved in this task |
| `mail.goldshore.ai/*` | `gs-mail` | yes (`apps/gs-mail/wrangler.toml`) | `JOBS_QUEUE`, `JOBS_QUEUE_DLQ` | Worker config (`env.prod.queues`) | none in file | none in file | Deploy workflow not resolved in this task |
| `ops.goldshore.ai/*` | `gs-control` | yes (`apps/gs-control/wrangler.toml`) | `GS_CONFIG`, `CONTROL_LOGS` | Worker config (`env.prod.kv_namespaces`) | `ENV` | none in file | Deploy workflow not resolved in this task |
| `signals.goldshore.ai/*` | `gs-signals` (expected) | not found in scoped wrangler files | unknown | unknown | unknown | unknown | Deploy workflow not resolved in this task |

## Known DNS gaps and one-line fixes
1. **`admin.goldshore.ai`** currently CNAMEs to apex and falls through to legacy Pages routing.  
   **Fix:** Point `admin.goldshore.ai` CNAME directly to `gs-admin.pages.dev` (dashboard DNS change).
2. **`api.goldshore.ai`** route is declared in `gs-api` wrangler, but deployment state is unverified.  
   **Fix:** Trigger/re-run `gs-api` production deploy so `api.goldshore.ai/*` route is attached to latest worker.
3. **`signals.goldshore.ai`** expected route not found in this repo’s wrangler scope; checklist incomplete.  
   **Fix:** Add/verify `signals.goldshore.ai/*` route in the `gs-signals` wrangler config and complete first deploy checklist.

## Recycle plan updates applied in this PR
- Renamed Pages project config name `gs-web` → `gs-web-staging` in `apps/gs-web/wrangler.toml` and `apps/gs-web/wrangler.jsonc`.
- Renamed worker config `gs-gateway` → `gs-platform-legacy` in `apps/gs-gateway/wrangler.toml` to avoid gateway-name collision during staging recycle work.
- DNS changes are intentionally **not** applied here (manual dashboard checklist item).
