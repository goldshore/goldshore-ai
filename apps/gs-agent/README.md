# Legacy `gs-agent` reference (non-deployable)

This directory is retained only to explain historical source and tests. It is
not an active application, is intentionally excluded from
`pnpm-workspace.yaml`, and has no Wrangler manifest or deployment scripts.

All active agent behavior belongs in `apps/gs-api`:

- HTTP ingress: `apps/gs-api/src/routes/agent.ts` mounted by the unified entrypoint;
- AI inference: the existing `AI` binding;
- state and persistence: the existing `gs-api` KV, D1, and R2 bindings;
- background work and events: the unified queue handler with `JOBS_QUEUE` and
  `EVENTS_QUEUE`; and
- public agent hostnames: routes declared on `apps/gs-api/wrangler.toml`.

Do not copy this source into a Worker, add a Wrangler manifest, restore package
scripts or workflows, or create Cloudflare bindings, routes, secrets, queues, or
dashboard configuration for `gs-agent`. Doing so requires an explicit,
human-approved architecture change that first updates `AGENTS.md` and
`pnpm-workspace.yaml`.
