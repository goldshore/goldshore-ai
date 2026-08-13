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

## Public OAuth value

The Google OAuth client ID is public and is stored as a Worker var:

```text
1054833139648-gt5o3k9uqhltt08nne0sigh8l3vodji7.apps.googleusercontent.com
```

Never commit the client secret, developer token, refresh token, access token, or
service-account key.

## Required secrets

Before enabling live OAuth or provider reads, a human operator must enter the
following `gs-api` values in the Cloudflare dashboard. Do not set production
secrets with a local command or repository script: `GOOGLE_OAUTH_CLIENT_SECRET`,
`OAUTH_TOKEN_ENCRYPTION_KEY`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `META_APP_SECRET`,
`X_CLIENT_SECRET`, `CLOUDFLARE_API_TOKEN`, and `GOLDCLAW_SANDBOX_API_TOKEN`.

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
| `CLOUDFLARE_API_TOKEN` | secret | Cloudflare read/reporting checks. |
| `CLOUDFLARE_ACCOUNT_ID` | var | Cloudflare account routing. |
| `CLOUDFLARE_ZONE_ID` | var | Optional zone routing. |
| `GOLDCLAW_SANDBOX_API_URL` | var | Container/sandbox API endpoint. |
| `GOLDCLAW_SANDBOX_API_TOKEN` | secret | Sandbox API auth. |
| `GOLDCLAW_SANDBOX_PROVIDER` | var | Optional provider label, such as Render, Fly, or Cloudflare Containers. |

For local development, keep values in `apps/gs-api/.dev.vars`, which is
gitignored.

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
