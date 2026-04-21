# goldshore-ai — GoldShore Labs Monorepo

## Repo → Worker → Domain
| App | CF Worker/Pages | Domain | Status |
|-----|----------------|--------|--------|
| `apps/gs-web` | `gs-web` Pages | `goldshore.ai`, `www.goldshore.ai` | ✅ Production |
| `apps/gs-admin` | `goldshore-admin` Pages | `admin.goldshore.ai` | ✅ CF Access protected |
| `apps/gs-api` | `gs-api` Worker | `api.goldshore.ai` | ✅ Live |
| `apps/gs-gateway` | `gs-platform` Worker | `gw.goldshore.ai` | ✅ Live |
| `apps/gs-agent` | `gs-agent` Worker | internal (queue consumer) | ✅ Live |
| `apps/gs-mail` | `gs-mail` Worker | `mail.goldshore.ai` | ✅ Live |

## Cloudflare Account
- **Account:** Gold Shore Labs (`f77de112d2019e5456a3198a8bb50bd2`)
- **Subdomain:** `goldshore.workers.dev`
- **D1:** `gs_platform_db` (9703574e) · `gs_audit_db` (1ae71d76)

## Deploy
```bash
# gs-web (goldshore.ai)
cd apps/gs-web && pnpm build && wrangler pages deploy dist

# gs-api
cd apps/gs-api && wrangler deploy

# gs-gateway (gs-platform)
cd apps/gs-gateway && wrangler deploy
```

## Secrets needed
- `CLOUDFLARE_API_TOKEN` · `CLOUDFLARE_ACCOUNT_ID` (GitHub Actions)
- `OPENAI_API_KEY` · `GEMINI_API_KEY` (gs-api)
- `MAILCHANNELS_SENDER_EMAIL` · `CONTACT_NOTIFICATION_EMAILS` (gs-web)
