# AGENTS.md — goldshore-ai

This repository is the active Gold Shore AI production monorepo. Agents should treat repository state, workspace configuration, Wrangler manifests, and CI as authoritative over stale planning notes.

## Architecture contract

This is intentionally a two-app deployable monorepo:

- `apps/gs-web` — Astro frontend and public/admin/docs UI routes.
- `apps/gs-api` — unified Cloudflare Worker backend for API routes, auth, scheduled work, queues, email handlers, AI/server logic, control-plane routes, and integrations.
- `packages/*` — shared libraries and contracts.
- `infra/*` — retained infrastructure workspaces and deployment/operations support; they are not additional product apps.

Do not create new deployable apps or satellite Workers such as `gs-agent`, `gs-gateway`, `gs-mail`, `gs-control`, `gs-cron`, `gs-signals`, or a separate admin frontend. Extend `gs-web` or `gs-api` instead unless a human explicitly changes this architecture contract.

`pnpm-workspace.yaml` is the definitive workspace boundary. If this file changes, update this document in the same PR.

## Source-of-truth order

When documentation disagrees, verify in this order:

1. Current code and `pnpm-workspace.yaml`.
2. `apps/gs-web/wrangler.toml` and `apps/gs-api/wrangler.toml`, the sole
   reviewable Cloudflare binding and route contracts for product Workers.
3. `.github/workflows/*`.
4. `infra/Cloudflare/*` and infrastructure docs.
5. Live Cloudflare configuration and deployed HTTP behavior.
6. README, `CLAUDE.md`, handoff notes, reports, and historical planning documents.

Do not restore a removed service, binding, route, workflow, or package solely because an older document names it.

## Package and build rules

Use pnpm from the repository root. Do not use npm or yarn for workspace operations.

Baseline commands:

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm lint
pnpm test
pnpm build
pnpm repo:health
```

For focused work, prefer filters rather than building unrelated workspaces:

```bash
pnpm --filter @goldshore/gs-web build
pnpm --filter @goldshore/gs-api build
```

Do not hand-edit `pnpm-lock.yaml` to resolve dependency drift. Regenerate it with pnpm and verify `pnpm install --frozen-lockfile` succeeds before proposing a merge.

## Cloudflare and deployment safety

- **Configuration authority:** treat `apps/gs-web/wrangler.toml` and
  `apps/gs-api/wrangler.toml` as the repository's canonical, reviewable Worker
  binding, route, migration, and trigger contracts. Cloudflare's dashboard is
  the execution authority and live-state authority. Other Cloudflare files are
  expected-state documentation or redacted inventory, never deploy inputs.
- A human must apply every production mutation in the Cloudflare dashboard
  through the GitHub `production` environment approval gate. CI must not mutate
  bindings, routes, secrets, migrations, triggers, DNS, Access, or email routing.
- Secret **values**, IdP client secrets, Access policies, and email routing are
  dashboard-only. Store neither their values nor Cloudflare credentials in
  GitHub Actions secrets, repository files, Wrangler TOML, or artifacts. Secret
  names may be documented and inventoried.
- Do not rename bindings, environments, Worker names, routes, queues, D1 databases, KV namespaces, R2 bindings, Durable Objects, or Secrets Store bindings without tracing every consumer first.
- Production environment naming must match the current manifest; do not substitute historical aliases from old docs.
- Do not add deployment workflows simply to work around an existing workflow. Fix the canonical workflow.
- Never change DNS, Worker routes, custom domains, Access policies, or production bindings based on memory alone. Verify the live owner first.

## Web routing safety

Astro source routes can be silently overridden by colliding files under `apps/gs-web/public`. Before changing or debugging a public route, inspect both `src/pages` and `public` for the same output path.

Avoid reintroducing stale static `index.html` files that shadow Astro pages.

## Security and secrets

Never commit:

- OpenAI or other provider API keys.
- Cloudflare API tokens, account credentials, Access secrets, or signing keys.
- GitHub tokens or deploy credentials.
- OAuth client secrets, service-account keys, database credentials, or private keys.
- Real `.env` / `.dev.vars` values, auth headers, session dumps, or production logs containing secrets.

Enter Cloudflare Worker secret values directly in the Cloudflare dashboard. Use
the relevant provider's secret store for provider-owned secrets; never copy
Cloudflare secret values or credentials into GitHub.

Do not expose server-side AI credentials in browser code. Browser AI features must call a server-side route or Worker.

## Change discipline

Before editing:

1. Read the latest issue/PR context and open branches affecting the same subsystem.
2. Read `README.md`, this file, and the relevant app-level configuration.
3. Check whether the requested behavior already exists elsewhere in the two-app architecture.
4. Keep changes scoped; do not mix unrelated migrations, UI redesigns, lockfile repairs, and infrastructure edits in one PR.

Before handoff or merge:

- Run the smallest relevant validation plus the repository-level checks affected by the change.
- Record the remote branch and commit SHA.
- State what was tested and what was not.
- Include preview/deployment URLs when applicable.
- Document any manual Cloudflare, GitHub, OpenAI, or other HITL step still required.

## GitHub / multi-agent handoff

GitHub issues and PRs are the shared state between Codex, Claude, Jules, Copilot, Gemini, and human operators. Never assume another agent can see unpushed local work.

Useful issue markers:

- `[agent:codex]`, `[agent:claude]`
- `[env:local]`, `[env:preview]`, `[env:production]`
- `[status:ready]`, `[status:blocked]`
- `[handoff:needed]`

A handoff should include branch, commit SHA, checks run, deployment/run URLs, blockers, and the next owner/action.

## Merge policy

Use a PR for production-impacting changes. At the top of the PR description, state the intended strategy:

- `Merge strategy: squash`
- `Merge strategy: merge`

Do not force-push shared branches or bypass failing required checks merely to complete an agent task.

## Related guidance

Read these when relevant:

- `README.md` — current repository/runtime map.
- `AGENT_HANDOFF.md` — continuity notes and operational handoffs.
- `CLAUDE.md` — additional historical and agent-specific context; verify against current code before relying on it.
- `docs/workspace-package-inventory.md` and architecture docs for migrations.

If any of those conflict with current workspace or runtime configuration, fix the documentation after verifying the live state rather than changing production to match stale text.
