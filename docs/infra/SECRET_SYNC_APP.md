# GoldShore Secret Sync App

Run this from the HP laptop:

```powershell
pnpm secrets:app
```

or directly:

```powershell
node scripts\secret-sync-app.mjs
```

or double-click:

```text
scripts\secret-sync-app.cmd
```

The launcher opens `http://127.0.0.1:8798/` and serves the UI from
`apps/gs-web/public/tools/secret-sync/index.html`.

## Auth

Preferred Cloudflare auth is now Wrangler SSO. In the app, click
`Cloudflare SSO` or `SSO Auto-Apply`. This runs:

```powershell
wrangler login --use-keyring --callback-host 127.0.0.1
```

Wrangler opens the browser, uses Cloudflare SSO, and stores its OAuth session in
the OS keychain/profile. The sync engine then writes Worker secrets with:

```text
--cloudflare-auth wrangler
```

This avoids rolling API tokens or creating one-off Cloudflare OAuth apps for
local secret synchronization.

If the app reports `Wrangler SSO ready`, `Cloudflare SSO` and `SSO Auto-Apply`
will not start another login window. `SSO Auto-Apply` then moves straight to the
strict dry-run preflight.

Cloudflare supports OAuth Authorization Code with PKCE for desktop/browser
clients. The app now exposes a `Cloudflare OAuth Setup` card with the exact
fields to use when creating a client in Cloudflare Dashboard at
`Manage Account > OAuth clients`.

For the local HP laptop app, create the OAuth client with these values:

```text
Client name: GoldShore Secret Sync
Client URL: https://goldshore.ai
Redirect callback: http://127.0.0.1:8798/oauth/cloudflare/callback
Response type: code
Grant type: authorization_code
Token authentication method: none
PKCE: required, S256
Client secret: not required
```

The app uses these Cloudflare endpoints:

```text
Authorization URL: https://dash.cloudflare.com/oauth2/auth
Token URL: https://dash.cloudflare.com/oauth2/token
```

Default scopes:

```text
workers-kv-storage.read workers-kv-storage.write workers-scripts.write account-settings.read
```

After Cloudflare creates the client, paste the Client ID into the app's
`OAuth Client ID` field and click `Save OAuth`. This stores it in
`env.secrets.runtime.json` as `CLOUDFLARE_OAUTH_CLIENT_ID`. The app also stores
`CLOUDFLARE_OAUTH_PUBLISHER_TXT` when you paste the public publisher
verification TXT value.

The callback URL is:

```text
http://127.0.0.1:8798/oauth/cloudflare/callback
```

The old environment-variable path still works if you prefer it:

```powershell
[Environment]::SetEnvironmentVariable('CLOUDFLARE_OAUTH_CLIENT_ID', '<client-id>', 'User')
[Environment]::SetEnvironmentVariable('CLOUDFLARE_ACCOUNT_ID', '<account-id>', 'User')
```

Optional endpoint overrides are available if Cloudflare changes or regionalizes
its OAuth URLs:

```powershell
[Environment]::SetEnvironmentVariable('CLOUDFLARE_OAUTH_AUTHORIZE_URL', 'https://dash.cloudflare.com/oauth2/auth', 'User')
[Environment]::SetEnvironmentVariable('CLOUDFLARE_OAUTH_TOKEN_URL', 'https://dash.cloudflare.com/oauth2/token', 'User')
```

Do not choose `client_secret_basic` or `client_secret_post` for this local
PKCE app. Those methods are for server-side confidential clients. If a
confidential client already exists and must be used anyway, set
`CLOUDFLARE_OAUTH_USE_CLIENT_SECRET=true`; otherwise the app intentionally does
not send a client secret during token exchange.

For GitHub device OAuth, set:

```powershell
[Environment]::SetEnvironmentVariable('GITHUB_OAUTH_CLIENT_ID', '<client-id>', 'User')
```

or paste the Client ID into the app and click `Save OAuth ID`. This stores only
`GITHUB_OAUTH_CLIENT_ID` in `env.secrets.runtime.json`.

For the `GoldShore Deployer` GitHub OAuth App, device flow must remain enabled.
The client secret is not required for this local device-flow login and should
not be added to the broad secret-sync manifest. If a client secret is pasted
into chat or logs, rotate it in GitHub and update only the system that actually
uses the confidential OAuth callback.

You can also use API token fallback fields in the app. By default, the UI checks
`Keep on this laptop`, which stores values in the ignored local runtime file:

```text
env.secrets.runtime.json
```

The app never prints token values or returns them from its local API.

For Gold Shore Labs token fallback, create or rotate the deploy/sync token here:

```text
https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/api-tokens
```

Required permissions for this sync/deploy token:

- Account: `Workers Scripts` = `Edit`.
- Account: `Workers KV Storage` = `Edit` for full compatibility, or `Read`
  if the token is only used to read KV fallback values.
- Account: `Account Settings` = `Read`.
- User: `Memberships` = `Read`.
- User: `User Details` = `Read`.
- Zone: `Workers Routes` = `Edit` for the deployed zones.

For local Codex/Claude operator access that can also manage OAuth clients, Zero
Trust Access apps, KV, Workers, Worker routes, and DNS for the GoldShore zones,
use the stricter runbook:

```text
docs/infra/CLOUDFLARE_AGENT_ACCESS.md
```

Then verify it with:

```powershell
pnpm cf:agent-access
```

or, in non-interactive shells:

```powershell
node scripts\check-cloudflare-agent-access.mjs
```

After creating the token, paste it into the Cloudflare API token fallback field
and click `Use Token`. The app verifies the token with Cloudflare's
`/user/tokens/verify` endpoint before overwriting saved local token values.
If verification fails, the previous local token values are left unchanged.

GitHub writes default to the authenticated GitHub CLI keyring session, not a
saved `GH_TOKEN`, because stale saved tokens override `gh` and cause
`HTTP 401: Bad credentials` even when `gh auth status` is healthy. Use the
`GitHub write auth` selector only when you intentionally want token fallback.

The sync engine enforces the same behavior for terminal use:

```powershell
node scripts\sync-secrets.mjs apply --github-auth cli
```

Use `--github-auth token` only with a freshly verified `GH_TOKEN` or
`GITHUB_TOKEN`.

The Cloudflare OAuth/API token fallback is used only to read KV fallback values
and write Cloudflare targets. It is not used as the secret value for
`CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN`; provide that value through your local
environment or ignored value file when you want to synchronize it as a secret.
If the same scoped token is intentionally the deploy token, check
`Also sync as deploy token` before saving it.

## Source Values

SSO proves who is allowed to write. It cannot recover plaintext values from
Cloudflare Worker secrets or GitHub secrets because those stores are write-only.

Use `Review Plan` to identify missing source names. The Source Vault section
then lets you paste required values once and saves them to
`env.secrets.runtime.json`, which is gitignored. `SSO Auto-Apply` runs a strict
dry-run first and only writes when all required source values are present.

The required values come from these places:

- `CONTROL_SYNC_TOKEN`: GoldShore internal shared secret between control/API
  automation. If no known current value exists, generate a new one in Source
  Vault and sync it everywhere.
- `JWT_SECRET`: GoldShore internal JWT signing secret. If no known current value
  exists, generate a new one in Source Vault; this can invalidate sessions that
  depend on the previous signing key.
- `ACCESS_CLIENT_SECRET`: Cloudflare Zero Trust Access service-token secret.
  Create or rotate a service token in Cloudflare Zero Trust, then paste the
  client secret. Existing Access service-token secrets are shown only when
  created or rotated.

Domain zone IDs are stored with explicit names so agents do not have to infer
them:

- `CLOUDFLARE_ZONE_ID` / `CF_ZONE_ID`: primary `goldshore.ai` zone.
- `CLOUDFLARE_GOLDSHORE_AI_ZONE_ID`: `goldshore.ai`.
- `CLOUDFLARE_GOLDSHORE_ORG_ZONE_ID`: `goldshore.org`.
- `CLOUDFLARE_RMARSTON_COM_ZONE_ID`: `rmarston.com`.
- `CLOUDFLARE_BANPROOF_ME_ZONE_ID`: `banproof.me`.

## Sync Behavior

The app calls `scripts/sync-secrets.mjs` with the canonical manifest at
`infra/secrets/secret-sync.manifest.yaml`.

- `Review Plan` runs a no-write audit.
- `Dry-Run Apply` exercises the apply path without writes.
- `Apply Sync` requires typing `APPLY` before writing GitHub and Cloudflare
  targets.
- `SSO Auto-Apply` starts Cloudflare SSO, waits for Wrangler auth, runs a strict
  dry-run, then applies only if the preflight succeeds.
- `Allow KV fallback` permits the manifest keys marked `kvFallback: true` to be
  read from the configured Cloudflare KV namespaces.

Optional KV fallback read failures are reported as warnings in the plan. They do
not block apply unless a required source value is still missing.

## Cloudflare Agent Setup

The app also includes a Cloudflare Agent Setup section backed by Cloudflare's
official prompt:

```text
https://developers.cloudflare.com/agent-setup/prompt.md
```

It can:

- Fetch the official prompt and show the detected command/config status.
- Merge Cloudflare MCP server definitions into `.mcp.json`,
  `.vscode/mcp.json`, and `.cursor/mcp.json` without removing existing servers.
- Run the official global skills installer:
  `npx -y skills add cloudflare/skills --skill '*' --yes --global`.
- Attempt the official Codex MCP registration commands and Codex Cloudflare MCP
  login.

This setup syncs agent tooling and MCP server registrations only. It does not
sync secret values; use Source Vault and SSO Auto-Apply for secret propagation.

Cloudflare API permissions for local agents are verified separately by
`pnpm cf:agent-access`. That command checks the local-only
`CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN` first, then compatible fallback token
names, without printing values.

The local browser app exposes the same check under Cloudflare Agent Setup as
`Check API Access`; it returns the same redacted report as the terminal
verifier.

References:

- Cloudflare OAuth client docs: https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/
- Cloudflare OAuth endpoint docs: https://developers.cloudflare.com/fundamentals/oauth/integrate-with-cloudflare/
- GitHub OAuth device flow docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
