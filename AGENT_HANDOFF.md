# Binding and deployment handoff

> Current operational handoff for the two-app Gold Shore product architecture.
> Repository state and the app-local Wrangler manifests take precedence over
> historical audits, inventories, and migration notes.

## Workspace and deployable boundary

`pnpm-workspace.yaml` is definitive. The only deployable product applications
are:

| Application | Runtime responsibility | Canonical contract |
| --- | --- | --- |
| `apps/gs-web` | Astro public, admin, and docs UI | `apps/gs-web/wrangler.toml` |
| `apps/gs-api` | Unified API, agent, AI, persistence, queues/events, mail, scheduled work, and control plane | `apps/gs-api/wrangler.toml` |

`packages/*` contains shared libraries. `infra/*` is retained operations support
and expected-state or historical documentation; it is not another product-app
boundary. Directories under `apps/` that are absent from `pnpm-workspace.yaml`
are not active applications and must not be built or deployed.

## Unified `gs-api` ownership map

The former agent responsibilities are already owned by the following `gs-api`
modules and production bindings:

| Capability | Existing implementation | Existing binding or trigger |
| --- | --- | --- |
| Agent HTTP ingress | `apps/gs-api/src/routes/agent.ts`, mounted by `apps/gs-api/src/index.ts`; agent hostnames are rewritten to `/agent` | `agent.goldshore.ai/*` and `agent.goldshore.org/*` routes on `gs-api` |
| AI inference | `/ai` and `/agent` route modules in `apps/gs-api` | Cloudflare Workers AI binding `AI` |
| Agent/control state and idempotency | `apps/gs-api` route and queue modules | KV bindings `KV` and `CONTROL_LOGS` |
| Durable persistence | `apps/gs-api` route and worker modules | D1 bindings `PLATFORM_DB`, `AUDIT_DB`, `SIGNALS_DB`, `JOBS_DB`, `RISK_RADAR_DB`, and `PAPER_DB` as applicable |
| Asset and telemetry persistence | `apps/gs-api` media, mail, telemetry, and risk modules | R2 bindings `GS_ASSETS`, `MAIL_ARCHIVE`, `TELEMETRY`, and `RISK_RADAR_R2` |
| Background agent jobs | `apps/gs-api/src/workers/queue-consumer.ts`, dispatched by the `queue` handler in `apps/gs-api/src/index.ts` | `JOBS_QUEUE` producer and `goldshore-jobs` consumer |
| Event publishing and consumption | Existing `gs-api` producers and the same unified queue handler | `EVENTS_QUEUE` producer and `gs-events` consumer |
| Signal evaluation | `apps/gs-api/src/workers/signals-evaluator.ts`, exported by `apps/gs-api/src/index.ts` | `GS_SIGNALS` Workflow binding |
| Scheduled work | `scheduled` handler in `apps/gs-api/src/index.ts` | `env.prod.triggers` cron contract |

Do not add a service binding to an agent Worker. Code needing an agent
capability should call an in-process `apps/gs-api` module; external HTTP clients
should use the `gs-api`-owned `/agent` surface. Publish asynchronous work through
the existing `JOBS_QUEUE` or `EVENTS_QUEUE` contract rather than provisioning a
new queue for a satellite Worker.

## Historical `apps/gs-agent` material

`apps/gs-agent` is **non-deployable legacy reference only**. It is outside the
pnpm workspace and is not a source of truth for routes, bindings, queue
consumers, environment names, secrets, scripts, or dashboard configuration.
Likewise, any `gs-agent` manifests retained under `infra/Cloudflare/legacy/`
are historical records only.

Do not restore an `apps/gs-agent/wrangler.toml`, deploy/preview script, workflow,
custom domain, Worker service binding, queue consumer, secret, or Cloudflare
dashboard entry. A separate `gs-agent` Worker requires an explicit,
human-approved architecture change that updates `AGENTS.md` and
`pnpm-workspace.yaml` in the same reviewed change before any deployment work.

## Binding and deployment procedure

1. Read `pnpm-workspace.yaml` and the relevant app-local Wrangler manifest.
2. Map new server behavior into an existing `apps/gs-api` route, worker, or
   library and reuse its declared binding where the resource contract matches.
3. If a resource contract must change, update only
   `apps/gs-api/wrangler.toml` (or `apps/gs-web/wrangler.toml` for web-only
   resources), its environment typings, tests, and consumer code together.
4. Run focused checks and the affected repository-level validations. Wrangler
   dry-runs must name `env.prod`; never run a bare production deploy.
5. Review CI artifacts, then obtain the GitHub `production` environment approval.
6. An authorized human applies every production mutation in the Cloudflare
   dashboard. CI and agents must not mutate production routes, bindings,
   triggers, migrations, DNS, Access, email routing, or secrets.
7. Record branch, commit SHA, checks, preview/deployment URL, blockers, and the
   next human action in the PR or issue handoff.

## Production handoff checklist

- [ ] Workspace membership still identifies only `apps/gs-web`, `apps/gs-api`,
      `packages/*`, and retained non-deploy `infra/*` workspaces.
- [ ] Product binding/route changes exist only in the applicable app-local
      Wrangler manifest.
- [ ] Agent routes resolve through `gs-api` and require the `KV` and `AI`
      capabilities enforced by the unified entrypoint.
- [ ] Persistence consumers use the existing `gs-api` KV, D1, or R2 bindings.
- [ ] Background jobs/events use the existing `gs-api` queue handlers and the
      relevant `JOBS_QUEUE` or `EVENTS_QUEUE` producer.
- [ ] Runtime `Env` declarations and manifest contract tests match the bindings.
- [ ] No active workflow, package script, route, or manifest targets `gs-agent`.
- [ ] No secret values or Cloudflare credentials are present in the diff or CI.
- [ ] Human dashboard action and post-change health checks are documented.

## Per-pass handoff template

- **Owner:** _agent or engineer_
- **Branch / commit:** _remote branch and SHA_
- **Scope:** _modules and contracts changed_
- **Checks:** _exact commands and outcomes_
- **URLs:** _preview, deployment, or run URLs_
- **Manual action:** _approved dashboard/GitHub/OpenAI step, or none_
- **Blocker / next owner:** _remaining work and responsible person_
