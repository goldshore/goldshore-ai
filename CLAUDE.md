# GoldShore AI agent guide

`AGENTS.md` is the authoritative operating contract. This file is a concise companion; current code, workspace definitions, Worker manifests, CI, and live Cloudflare state override historical notes.

## Architecture

This is a pnpm 9/Turborepo monorepo with two deployable applications:

- `apps/gs-web`: Astro public, admin, and docs UI.
- `apps/gs-api`: unified Worker for APIs, auth, jobs, queues, mail, AI, and integrations.

Do not create satellite Workers or standalone admin apps. Shared contracts live in `packages/*`; `pnpm-workspace.yaml` defines the workspace boundary.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm lint
pnpm test
pnpm build
pnpm --filter @goldshore/gs-web build
pnpm --filter @goldshore/gs-api build
pnpm repo:health
```

Use pnpm at the repository root, never npm or yarn. Regenerate, do not hand-edit, `pnpm-lock.yaml`.

## Cloudflare guardrails

- `apps/gs-web/wrangler.toml` and `apps/gs-api/wrangler.toml` are the reviewed binding and route contracts; the dashboard is live-state authority.
- Production uses the named `prod` environment. Both manifests pin the renamed Worker names, so never remove `[env.prod].name` or run a bare deploy.
- Validate locally with `pnpm exec wrangler deploy --env prod --dry-run` only when relevant. Production mutations occur through the approved GitHub `production` environment.
- Secrets, Access, DNS, routes, email configuration, and credential values are dashboard-owned. Never commit them; document secret names only.

## Handoff discipline

Fetch `origin/main` and preserve unrelated changes before work. Use small PRs; state the merge strategy, branch and commit, checks run, remaining risks, and any human Cloudflare/GitHub action. Treat source, CI, deployment/version, bindings, Access, and runtime endpoints as separate verification gates.