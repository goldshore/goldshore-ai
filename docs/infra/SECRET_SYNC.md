# Secret Sync

The canonical contract for infrastructure and AI-agent secret names is:

- `infra/secrets/secret-sync.manifest.yaml`
- `scripts/sync-secrets.mjs`
- `.github/workflows/sync-secrets.yml`

Secret values must never be committed. The sync script reads values from
environment variables, ignored local files (`env.secrets.runtime.json` or
`.env.local`), or the explicitly enabled legacy Cloudflare KV fallback for the
few historical keys listed in the manifest.

## Commands

```bash
node scripts/sync-secrets.mjs check
node scripts/sync-secrets.mjs audit --strict
node scripts/sync-secrets.mjs apply --dry-run
node scripts/sync-secrets.mjs apply --allow-kv-source --cloudflare-auth wrangler
pnpm secrets:app
```

`check` enforces disallowed workflow secret names. `audit` prints target plans
without values. `apply` writes to GitHub Actions secrets, GitHub Agents secrets,
and Cloudflare Worker secrets using the manifest.

`pnpm secrets:app` starts the local browser workflow documented in
`docs/infra/SECRET_SYNC_APP.md`.

Use `--cloudflare-auth wrangler` after `wrangler login` to write Cloudflare
Worker secrets through Cloudflare browser SSO instead of a local API token.

## Local Value File

Use an ignored local file when syncing from a workstation:

```json
{
  "CLOUDFLARE_ACCOUNT_ID": "...",
  "CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN": "...",
  "CONTROL_SYNC_TOKEN": "...",
  "JWT_SECRET": "...",
  "ACCESS_CLIENT_SECRET": "..."
}
```

The script does not print values. Add `--fingerprints` only when you need to
compare value identity without exposing plaintext.
