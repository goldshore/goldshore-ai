# GitHub to Cloudflare Webhook Gateway

Merge Strategy: Merge Commit

The GitHub webhook and OAuth gateway is implemented in the canonical API Worker:

- Webhook endpoint: `https://api.goldshore.ai/webhook/github`
- GitHub OAuth callback: `https://api.goldshore.ai/oauth/github/callback`
- Runtime owner: `apps/gs-api`

No separate Worker should be created for this flow.

Cloudflare Access must allow the two endpoint paths above to reach `gs-api`
before Worker-level auth runs. They are tracked as `Goldshore API`
`public_paths` in `infra/Cloudflare/desired-state.yaml`.

## Managed Secret Names

Rotate these values through the local secret bundle, then sync through `infra/secrets/secret-sync.manifest.yaml`.

Required for the private GitHub App and webhook gateway:

- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_INSTALLATION_ID`

Required for Cloudflare Access service-token automation:

- `ACCESS_CLIENT_ID` or `CF_ACCESS_CLIENT_ID`
- `ACCESS_CLIENT_SECRET` or `CF_ACCESS_CLIENT_SECRET`

Optional when GitHub OAuth App login is used:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

Optional post-deploy/status settings:

- `GITHUB_STATUS_TOKEN`
- `GITHUB_WEBHOOK_POST_DEPLOY_URLS`
- `GITHUB_WEBHOOK_POST_DEPLOY_TOKEN`

Other provider rotation names currently tracked:

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `STRIPE_API_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`

## Rotation Flow

1. Generate a new GitHub App webhook secret and private key in GitHub App settings.
2. Update the local ignored bundle, preferably `env.secrets.runtime.json` or `.env.local`.
3. If the OAuth App is still used, generate a new `GITHUB_OAUTH_CLIENT_SECRET` and update the bundle.
4. Create a new Cloudflare Access service token and update both client ID and client secret names.
5. Rotate any provider secrets still in use, including Turnstile, Stripe, and Resend.
6. Run `pnpm env:check`.
7. Run `node scripts/sync-secrets.mjs audit --strict`.
8. Apply with `node scripts/sync-secrets.mjs apply --target cloudflare` and the GitHub sync mode appropriate for the current terminal session.
9. Deploy `gs-api` and `gs-web` through the canonical CI workflows.
10. Send a GitHub webhook ping and verify the Worker accepts the ping, rejects invalid signatures, and records sanitized event metadata.
11. Delete old keys and tokens after the new flow is verified.

## Behavior

`POST /webhook/github` requires `X-Hub-Signature-256`, `X-GitHub-Event`, and `X-GitHub-Delivery`. The Worker verifies the HMAC with `GITHUB_WEBHOOK_SECRET` before parsing or acting on the payload.

Accepted events default to `ping`, `push`, `pull_request`, `workflow_run`, and `deployment_status`. Set `GITHUB_WEBHOOK_ALLOWED_EVENTS` to a comma-separated list to narrow that set.

Post-deploy hooks run only for default-branch pushes, successful workflow runs, and successful deployment statuses. The Worker can report a commit status using GitHub App installation credentials. `GITHUB_STATUS_TOKEN` is a fallback only.
