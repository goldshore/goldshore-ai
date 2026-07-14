# GoldClaw integration runbook

Merge Strategy: Merge Commit

GoldClaw is the GoldShore operator agent surface for marketing, monetization,
SEO, social growth, infrastructure readiness, and rapid product experiments.
All implementation lives in the two-app monorepo:

- UI: `apps/gs-web/src/pages/admin/goldclaw.astro`
- API: `apps/gs-api/src/routes/goldclaw.ts`

Do not add satellite workers for Google, Meta, X, sandbox, email, or social
tasks. Route those through `gs-api`.

## Current surface

- `GET /goldclaw` returns the manifest, safety model, provider readiness, and
  30-day launch plan.
- `GET /goldclaw/readiness` returns provider readiness only.
- `GET /goldclaw/plan` returns the launch plan.
- `POST /goldclaw/brief` returns a deterministic strategy brief based on
  currently configured providers.
- `GET /goldclaw/oauth/google/start` starts Google OAuth.
- `GET /goldclaw/oauth/google/callback` exchanges the Google code and stores an
  encrypted token payload in KV.
- `GET /goldclaw/oauth/status` reports encrypted OAuth connection status.

The admin page is `/admin/goldclaw`.

## 2026-07-04 MCP and Cloudflare status

- VS Code, Claude, and repo MCP configs point `goldshore` at
  `https://mcp.goldshore.ai/mcp`.
- `mcp.goldshore.ai/*` implementation work must flow through `apps/gs-api`
  under the two-app monorepo rule. Treat older `apps/gs-mcp` references as
  historical unless the architecture rule changes explicitly.
- Cloudflare API access works through the Wrangler OAuth token for account,
  zone, Worker script, and route reads/writes.
- DNS, Access, OAuth client, WAF/ruleset, and security-setting access should be
  verified with `pnpm cf:agent-access` before agent work begins. The canonical
  local-only token name is `CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN`.
- Direct MCP HTTP requests are being stopped before the Worker by a Cloudflare
  managed challenge. VS Code cannot complete MCP initialization until a
  Cloudflare WAF/security rule skips browser challenges for the MCP API path,
  while Access/OAuth remains the auth gate.
- Any local Cloudflare token that failed verification or appeared in chat,
  terminal output, screenshots, or logs should be rotated before reuse.

VS Code MCP auth prompt:

- If VS Code says `Having trouble authenticating to
  goldshore.cloudflareaccess.com` and offers `URL Handler`, choose `URL
  Handler` once. That is VS Code's fallback when the local loopback callback
  does not complete.
- If the prompt loops or the MCP server still fails to start, the issue is not
  the button choice. The current live endpoint returns a Cloudflare managed
  challenge for `https://mcp.goldshore.ai/mcp` and does not expose the expected
  OAuth protected-resource metadata at the `.well-known` path.
- Durable fix: rotate the Cloudflare API credential, create a WAF/security skip
  for browser challenges on the MCP API path, and ensure the Access/OAuth
  configuration presents the MCP OAuth metadata that VS Code expects.

## Public OAuth value

The Google OAuth client ID is public and is stored as a Worker var:

```text
1054833139648-gt5o3k9uqhltt08nne0sigh8l3vodji7.apps.googleusercontent.com
```

Never commit the client secret, developer token, refresh token, access token, or
service-account key.

## Required secrets

Set these with `wrangler secret put` for `gs-api` before enabling live OAuth or
provider reads:

```bash
cd apps/gs-api

npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --env prod
npx wrangler secret put OAUTH_TOKEN_ENCRYPTION_KEY --env prod
npx wrangler secret put GOOGLE_ADS_DEVELOPER_TOKEN --env prod
npx wrangler secret put META_APP_SECRET --env prod
npx wrangler secret put X_CLIENT_SECRET --env prod
npx wrangler secret put STRIPE_API_KEY --env prod
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env prod
npx wrangler secret put OPENCLAW_API_KEY --env prod
npx wrangler secret put CLOUDFLARE_API_TOKEN --env prod
npx wrangler secret put GOLDCLAW_SANDBOX_API_TOKEN --env prod
```

Recommended production vars/secrets:

| Name | Type | Purpose |
| --- | --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` | var | Public Google OAuth client ID. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | secret | Google OAuth token exchange. |
| `GOOGLE_OAUTH_REDIRECT_URI` | var | `https://api.goldshore.ai/goldclaw/oauth/google/callback`. |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | secret | AES-GCM key material used before KV token storage. |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | secret | Google Ads API developer token. |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | secret or var | Optional manager account ID. |
| `GOOGLE_ANALYTICS_PROPERTY_ID` | var | Optional GA property routing. |
| `META_APP_ID` | var | Meta app ID. |
| `META_APP_SECRET` | secret | Meta OAuth/token exchange. |
| `META_BUSINESS_ID` | var | Optional Business Manager ID. |
| `META_AD_ACCOUNT_ID` | var | Optional ad account ID. |
| `META_PIXEL_ID` | var | Optional pixel ID. |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | var | Optional Instagram professional account ID. |
| `X_CLIENT_ID` | var | X OAuth client ID. |
| `X_CLIENT_SECRET` | secret | X OAuth/token exchange. |
| `X_AD_ACCOUNT_ID` | var | Optional X ads account ID. |
| `STRIPE_API_KEY` | secret | Stripe reporting and commerce API access. |
| `STRIPE_WEBHOOK_SECRET` | secret | Stripe webhook signature verification. |
| `STRIPE_CONNECT_CLIENT_ID` | secret or var | Optional Stripe Connect onboarding. |
| `CLOUDFLARE_API_TOKEN` | secret | Cloudflare read/reporting checks. |
| `CLOUDFLARE_ACCOUNT_ID` | var | Cloudflare account routing. |
| `CLOUDFLARE_ZONE_ID` | var | Optional zone routing. |
| `GOLDCLAW_SANDBOX_API_URL` | var | Container/sandbox API endpoint. |
| `GOLDCLAW_SANDBOX_API_TOKEN` | secret | Sandbox API auth. |
| `GOLDCLAW_SANDBOX_PROVIDER` | var | Optional provider label, such as Render, Fly, or Cloudflare Containers. |
| `OPENCLAW_BASE_URL` | var | Self-hosted OpenClaw-compatible `/v1` base URL. |
| `OPENCLAW_API_KEY` | secret | Bearer token for OpenClaw requests. |
| `OPENCLAW_MODEL` | var | Optional default OpenClaw model name. |

For local development, keep values in `apps/gs-api/.dev.vars`, which is
gitignored.

## Business-tool integration plan

GoldClaw should remain the planning and approval surface. `gs-api` owns OAuth,
secret storage, API calls, and audit logs. The existing `/integrations` routes
and admin integrations library remain useful for operational setup, but live
operator actions should flow through GoldClaw approval gates before mutation.

| Provider | Current code surface | First live milestone | Write policy |
| --- | --- | --- | --- |
| Google Ads, Search Console, Analytics, Business Profile | `apps/gs-api/src/routes/goldclaw.ts`, `apps/gs-api/src/routes/oauth.ts`, `apps/gs-api/src/lib/GoldClaw.ts` | Finish Google OAuth callback, encrypted token storage, and read-only status cards. | Draft campaign, SEO, profile, and content changes only. |
| Meta Business, Instagram, Facebook Pixel, WhatsApp | `apps/gs-api/src/routes/oauth.ts`, `apps/gs-api/src/lib/IntegrationRegistry.ts`, admin integration helpers | Add Meta OAuth status to GoldClaw and connect Business Manager, pixel, Instagram, and WhatsApp read checks. | Draft content, audience, pixel, and messaging changes only. |
| Stripe | `apps/gs-api/src/lib/Stripe.ts`, `apps/gs-api/src/lib/IntegrationRegistry.ts`, WhatsApp setup commands | Connect account/revenue/customer reads and webhook verification. | No checkout, subscription, refund, invoice, or product-price changes without approval. |
| OpenClaw | `apps/gs-admin/src/lib/llm-abstraction.ts`, GoldClaw provider manifest | Add health/model checks, request audit metadata, and route selected draft-generation jobs through OpenClaw. | No autonomous external writes; treat outputs as drafts. |
| Cloudflare | `apps/gs-api`, GoldClaw provider manifest, `scripts/check-cloudflare-agent-access.mjs` | Rotate exposed tokens, grant DNS/Access/OAuth/KV/Workers scopes, verify with `pnpm cf:agent-access`, and add a no-challenge rule for `mcp.goldshore.ai/mcp` if still blocked. | Worker/DNS/security changes require explicit approval. |
| Zapier/custom business tools | `apps/gs-api/src/lib/IntegrationRegistry.ts` | Keep as webhook/custom connectors after core Google, Meta, Stripe, OpenClaw, and Cloudflare are healthy. | Mutations must be idempotent, logged, and approval gated. |

Implementation order:

1. Rotate Cloudflare token and unblock VS Code MCP by removing managed
   challenges from the MCP API path.
2. Complete read-only GoldClaw cards for Google, Meta, Stripe, Cloudflare, and
   OpenClaw readiness.
3. Replace token-rotation stubs with real refresh-token persistence for Google
   and Meta.
4. Add Stripe webhook signature verification and revenue summaries.
5. Add OpenClaw health/model checks and audit logs before using it for briefs.
6. Add approval records for any action that can publish, spend, refund, edit
   DNS, deploy, or message customers.

## Safety model

GoldClaw starts in `draft-first` mode:

- Read metrics where OAuth/API access is available.
- Draft strategies, content, campaign changes, landing page ideas, and client
  reports.
- Require explicit human approval before publishing posts, changing campaign
  budgets, editing profiles, or mutating ad accounts.
- Store OAuth token responses only after encryption with
  `OAUTH_TOKEN_ENCRYPTION_KEY`.
- Run long-lived compute, browser automation, and code execution in a sandbox
  service called through `gs-api`, not inside a Worker request path.

## 30-day order of work

1. Days 1-3: rotate exposed tokens, configure Cloudflare Access, and connect
   Google OAuth read scopes.
2. Days 4-10: pull read-only Google, Meta, X, Cloudflare, and sandbox readiness
   into admin status cards.
3. Days 11-20: generate content calendars, SEO briefs, ad experiments, and
   client deliverables with approval gates.
4. Days 21-30: ship monetization loops, weekly reports, and first client-facing
   productized service workflows.
