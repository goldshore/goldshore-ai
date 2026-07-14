# Cloudflare Agent API Access

Merge Strategy: Merge Commit

Use this for the local Codex/Claude GoldClaw operator token. This is stronger
than the normal deploy token, so keep it local to the HP laptop unless a future
approval explicitly broadens the target.

## Exact Dashboard URL

Create or rotate the token here:

```text
https://dash.cloudflare.com/f77de112d2019e5456a3198a8bb50bd2/api-tokens
```

Use `Create Token` > `Custom token`.

## Token Name

```text
GoldClaw Local Agent Admin
```

## Required Permissions

User permissions:

- `API Tokens Read`
- `Memberships Read`
- `User Details Read`

Account permissions for the Gold Shore Labs account:

- `Account Settings Read`
- `OAuth Clients Write`
- `Workers Scripts Write` or dashboard `Workers Scripts Edit`
- `Workers KV Storage Write` or dashboard `Workers KV Storage Edit`
- `Zero Trust Write` or dashboard `Zero Trust Edit`

If using granular Access permissions instead of broad `Zero Trust Write`, include:

- `Access: Apps and Policies Write` or dashboard `Access: Apps and Policies Edit`
- `Access: Identity Providers Write` or dashboard `Access: Identity Providers Edit`
- `Access: Organizations, Identity Providers, and Groups Write` or dashboard `... Edit`
- `Access: Service Tokens Write` or dashboard `Access: Service Tokens Edit`

Zone permissions for these four zones:

- `goldshore.ai`: `80e5c7c62d36a73f7a0e31bb3cd9223a`
- `goldshore.org`: `5a9fdec7da4d4e4c53e44bf50a8aeb27`
- `rmarston.com`: `13bd16969996573b7796efe18ba9620c`
- `banproof.me`: `b896df036fb26d299094e2fbf2946735`

For each zone, add:

- `Zone Read`
- `DNS Write` or dashboard `DNS Edit`
- `Workers Routes Write` or dashboard `Workers Routes Edit`

## Store Locally

Preferred local-only variable:

```powershell
[Environment]::SetEnvironmentVariable('CLOUDFLARE_GOLDCLAW_AGENT_ADMIN_TOKEN', '<new-token>', 'User')
```

Then open a new terminal in the repo and run:

```powershell
pnpm cf:agent-access
```

If `pnpm` tries to run an install or asks for module cleanup confirmation in a
non-interactive shell, use the direct verifier:

```powershell
node scripts\check-cloudflare-agent-access.mjs
```

The checker also reads `env.secrets.runtime.json`, but it never prints token
values. It checks all known local token names and only reports variable names,
policy gaps, and read-only API probe results.

## Verification Contract

The token is considered ready only when:

- `/user/tokens/verify` reports an active token.
- The token policy can be inspected with `API Tokens Read`.
- Required write permission groups are present.
- Read probes pass for account details, Workers, KV namespaces, OAuth clients,
  Zero Trust Access apps, identity providers, DNS records, and Worker routes.

If `pnpm cf:agent-access` says policy inspection failed, add `API Tokens Read`
to the token. Without policy inspection, a read probe can prove visibility but
cannot prove safe write authority.

## Rotation Note

If any token value was pasted into chat, logs, terminal output, screenshots, or
Git history, treat it as exposed. Rotate it first, then run:

```powershell
pnpm cf:agent-access
pnpm goldclaw:agent-env
```

References:

- Cloudflare API token permissions: https://developers.cloudflare.com/fundamentals/api/reference/permissions/
- Cloudflare API token creation: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- Cloudflare OAuth client setup: https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/
- Cloudflare One API and Terraform: https://developers.cloudflare.com/cloudflare-one/api-terraform/
