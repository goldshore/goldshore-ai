# GoldShore Agent (`apps/gs-agent`)

Queue-driven Cloudflare Worker for background agent processing.

## Overview

`gs-agent` handles background jobs from the `goldshore-jobs` queue, exposes lightweight fetch routes for status and templates, and protects non-public fetch endpoints with Cloudflare Access.

The repo also contains a placeholder bot module at `src/bots/codex-bot.ts` for future queue-driven automation work.

## Cloudflare configuration

- App-local Wrangler config: `apps/gs-agent/wrangler.toml`
- Canonical Cloudflare manifest used by package scripts: `infra/Cloudflare/gs-agent.wrangler.toml`
- Live deploy workflows: `.github/workflows/deploy-gs-agent.yml` and `.github/workflows/preview-gs-agent.yml`
- Queue consumer: `goldshore-jobs`

## Routes and endpoints

Fetch routes implemented in `src/index.ts`:

- `GET /` — HTML status page
- `GET /health` — JSON health response
- `GET /templates` — authenticated template/module inventory

Background handling implemented in the worker export:

- Queue consumer for `goldshore-jobs` that logs each processed message and acknowledges it

## Development

```bash
pnpm install
pnpm --filter @goldshore/gs-agent dev
pnpm --filter @goldshore/gs-agent build
pnpm --filter @goldshore/gs-agent test
```

Deployment-oriented scripts exposed by the package:

```bash
pnpm --filter @goldshore/gs-agent deploy
pnpm --filter @goldshore/gs-agent deploy:preview
```

## Deployment

- Production workflow: `.github/workflows/deploy-gs-agent.yml`
- Preview workflow: `.github/workflows/preview-gs-agent.yml`
- Package scripts reference `infra/Cloudflare/gs-agent.wrangler.toml` as the canonical deployment manifest.

## Auth behavior

- `/` and `/health` are public.
- Other fetch routes require successful Cloudflare Access verification.
- In production, `CLOUDFLARE_ACCESS_AUDIENCE` must be configured for protected routes.
