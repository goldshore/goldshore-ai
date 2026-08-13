# Cloudflare deploy checklist

## Deployable boundary

`pnpm-workspace.yaml` is definitive: the product has only `apps/gs-web` and
`apps/gs-api`. Files for former satellite applications, including
`apps/gs-agent`, are non-deployable legacy reference. Do not create or restore a
separate agent Worker, route, binding, workflow, script, queue consumer, or
dashboard configuration without an explicit human-approved architecture change.

## gs-api

- Treat `apps/gs-api/wrangler.toml` as the sole reviewable contract for unified
  API, agent, AI, persistence, queues/events, mail, cron, and control behavior.
- Keep agent hostnames on `gs-api`; the unified entrypoint maps them to `/agent`.
- Use `AI` for inference, existing KV/D1/R2 bindings for persistence, and
  `JOBS_QUEUE` or `EVENTS_QUEUE` for asynchronous publishing.
- Confirm the unified `queue`, `scheduled`, and Workflow handlers cover required
  background processing; do not delegate them to a satellite Worker.
- Build and dry-run `env.prod` from `apps/gs-api`; never use a manifest under
  `infra/Cloudflare/` as deploy input.
- Obtain the GitHub `production` approval before an authorized human applies the
  reviewed mutation in the Cloudflare dashboard.

## gs-web

- Build `apps/gs-web` with the Astro Cloudflare adapter in server mode.
- Confirm `dist` contains the generated server output and static assets.
- Confirm `src/worker.ts` remains Wrangler's `main` entry point.
- Confirm the `ASSETS` binding points at `./dist`.
- Deploy `env.prod` as the single `gs-web-prod` Worker release.
- Smoke-test `goldshore.ai`, `goldshore.org`, `admin.goldshore.ai`, and
  `admin.goldshore.org`; compare their release/version marker when available.
- Never upload the client asset subtree as a second static project.

## Architecture-change gate

A Pages migration is permitted only as an explicit replacement after every
dynamic web endpoint has moved into `apps/gs-api`. It must not coexist with the
Worker-with-Assets release.
