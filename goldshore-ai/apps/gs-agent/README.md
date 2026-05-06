# apps/gs-agent

## Overview
The `gs-agent` worker is the canonical GoldShore agent service. It serves a small Hono-based status UI, exposes a health endpoint, and enforces Cloudflare Access auth on protected routes. The deprecated `apps/goldshore-agent` directory now mirrors this implementation; legacy workflows still reference `infra/cloudflare/goldshore-agent.wrangler.toml`.

Cloudflare metadata (from `infra/cloudflare/gs-agent.wrangler.toml`):
- Worker base name: `gs-agent` (per-environment names: `gs-agent-dev`, `gs-agent-preview`, `gs-agent-prod`)
- Queue consumer: `goldshore-jobs`
- Compatibility date: `2024-03-20`

Codex bot decision:
- `jules-bot` remains a separate Node.js webhook service.
- A placeholder `codex-bot` module now lives in `apps/gs-agent/src/bots/codex-bot.ts` for future queue-driven automation.

## Routes/Endpoints
- `/` → status UI
- `/health` → JSON health response

## Configuration
- The Wrangler configuration lives in `infra/cloudflare/gs-agent.wrangler.toml` and defines queue consumers for `goldshore-jobs`.
- Local dev exposes the worker via `wrangler dev`.

## Local Dev
```bash
pnpm install
pnpm --filter ./apps/gs-agent dev
pnpm --filter ./apps/gs-agent build
```

## Deploy
- Production deploy: `.github/workflows/deploy-agent.yml`
- Preview deploy: `.github/workflows/preview-agent.yml`
- Uses `wrangler deploy` with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets

<!-- // [AUTO-UPDATE] Updated by Jules AI on 2026-01-23 01:43 -->
```bash
pnpm --filter ./apps/gs-agent deploy
```
