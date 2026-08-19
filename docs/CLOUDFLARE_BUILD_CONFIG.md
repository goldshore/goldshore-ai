# Cloudflare Workers Build Configuration

**Last Updated**: 2026-08-19

## Overview

This document defines the correct Cloudflare Workers Build settings for both production workers in the `goldshore-ai` monorepo. These configurations must be set in the Cloudflare dashboard and are **not** version-controlled via `wrangler.toml`.

## Workers Build Settings

### gs-web (Frontend SSR Worker)

| Setting | Value |
|---------|-------|
| **Worker Name** | `gs-web` |
| **Root Directory** | `/apps/gs-web` |
| **Build Command** | `pnpm install && pnpm --filter @goldshore/gs-web build:pages` |
| **Caching** | Enabled |

**Why this command:**
- `pnpm install` — Install dependencies from monorepo lock file
- `pnpm --filter @goldshore/gs-web` — Scope build to the gs-web workspace (prevents running root-level scripts in wrong context)
- `build:pages` — Runs Astro SSR build, outputs to `./dist` with Worker entry at `./src/worker.ts`

### gs-api (Backend Worker)

| Setting | Value |
|---------|-------|
| **Worker Name** | `gs-api` |
| **Root Directory** | `/apps/gs-api` |
| **Build Command** | `pnpm install` |
| **Caching** | Enabled |

**Why this command:**
- `pnpm install` — Install dependencies from monorepo lock file
- **No build step** — Wrangler handles TypeScript bundling and minification at deploy time
- `package.json` build script (`wrangler deploy --env prod --dry-run`) is for local validation only, not for dashboard builds

## Common Issues

### Issue: Preview deployments return 502 Bad Gateway

**Cause**: Build command runs undefined script or fails during compilation.

**Fix**: Verify the exact build command matches the table above. If gs-api is configured with `pnpm install && pnpm build:pages`, it will fail because `build:pages` only exists in root and gs-api package.json, not as a runnable target in the gs-api workspace.

### Issue: Build succeeds but worker doesn't boot

**Cause**: Worker code not properly bundled by Wrangler, or environment bindings misconfigured.

**Verify**:
1. Build command completed without errors
2. `wrangler.toml` in `/apps/gs-api` or `/apps/gs-web` is syntactically valid
3. All required Cloudflare bindings (KV, D1, R2, Queues, etc.) are configured in the dashboard and match `wrangler.toml`

## Updating Build Configuration

**Dashboard Path**: dash.cloudflare.com → Workers & Pages → [Worker Name] → Settings → Build & Deploy

1. Click **Edit** on the Build configuration section
2. Update the **Build command** field to the correct value from the table above
3. Click **Save**
4. Trigger a manual redeploy or wait for the next git push to rebuild

## Related Files

- `apps/gs-web/package.json` — Contains `build:pages` script (Astro build)
- `apps/gs-api/package.json` — Contains no build script (Wrangler is the build tool)
- `apps/gs-web/wrangler.toml` — SSR Worker config with asset bindings
- `apps/gs-api/wrangler.toml` — API Worker config with all environment bindings
- `.github/workflows/deploy-gs-web.yml` — CI/CD deploy workflow
- `.github/workflows/deploy-gs-api.yml` — CI/CD deploy workflow

## Deployment Flow

```
git push → GitHub Actions workflow
  ↓
wrangler deploy --env prod (or preview)
  ↓
Cloudflare workers-build service
  ├─ Clone monorepo
  ├─ cd /apps/gs-web (or /apps/gs-api)
  ├─ Run: pnpm install
  ├─ Run: pnpm --filter @goldshore/gs-web build:pages (or skip for gs-api)
  ├─ Wrangler bundles output
  └─ Deploy to Cloudflare Workers
```

## Notes

- Both workers use `pnpm 9` workspace dependencies
- Monorepo lock file (`pnpm-lock.yaml`) is required for reproducible builds
- If changing `package.json` scripts, update this document and the build command
- Preview and production environments use the same build command
