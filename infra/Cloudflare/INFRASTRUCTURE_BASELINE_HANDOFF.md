# GoldShore Cloudflare infrastructure baseline

This is the implementation handoff for the two-app production architecture. It
describes repository intent; it does not assert that the Cloudflare dashboard has
already been changed.

> **Handoff status: UNVERIFIED REPORT.** Every DNS record, Worker route, Access
> policy, and dashboard binding mentioned below is expected state only until an
> authorized operator completes the read-only procedure in
> [`reports/cloudflare-live-state-handoff.md`](../../reports/cloudflare-live-state-handoff.md).
> Historical dashboard observations and inferred wildcard coverage do not verify
> an item. Report discrepancies without changing Cloudflare or the Wrangler
> manifests.

## Runtime ownership

| Surface | Canonical runtime | Responsibilities |
| --- | --- | --- |
| `goldshore.ai`, `goldshore.org` | `gs-web-prod` | Astro marketing UI and static assets |
| `admin.goldshore.ai`, `admin.goldshore.org` | `gs-web-prod` | Astro admin UI protected by Cloudflare Access |
| `api.goldshore.ai`, `api.goldshore.org` | `gs-api-prod` | Auth, API, D1, R2, queues, mail, workflows, integrations |
| legacy API aliases | `gs-api-prod` | Compatibility host rewrite into the same Hono middleware stack |

There is no standalone admin, mail, gateway, agent, or preview application in the
repository contract. Do not delete live legacy resources until request logs and
route inventory prove that traffic has moved.

## Expected binding baseline (unverified report)

The canonical `gs-web` manifest expects `ASSETS`, `IMAGES`, and `SESSION`, plus
public runtime variables. Whether the live Worker has that exact set is
unverified; the manifest, rather than historical dashboard observations, is the
comparison baseline.

`gs-api-prod` owns:

- D1: platform, audit, signals, risk radar, jobs, and paper trading databases.
- KV: API/session compatibility, control logs, risk cache, and trading state.
- R2: assets, inbound mail archive, telemetry, and raw risk data.
- Queues: jobs, events, transactional mail, and the configured dead-letter queue.
- Workflow: `GS_SIGNALS` bound to `gs-signals-evaluator`.
- Platform services: Workers AI and native Email Sending.

The checked-in manifests are `apps/gs-api/wrangler.toml` and
`apps/gs-web/wrangler.toml`. Files under `infra/Cloudflare/` mirror those manifests
for dashboard review and drift checks.

## Dashboard implementation order

1. In Email > Email Sending, onboard the sending domain and validate SPF, DKIM,
   and DMARC. Approve the three sender addresses declared by `EMAIL`.
2. In Email > Email Routing, route required `goldshore.ai` and `goldshore.org`
   recipient addresses to the `gs-api-prod` Worker `email()` handler. Keep the
   existing forwarding destination verified.
3. Verify `gs-api-prod` has `EMAIL`, `MAIL_ARCHIVE`, `MAIL_JOBS_QUEUE`, and all D1
   bindings shown by `wrangler deploy --env prod --dry-run`.
4. Apply D1 migration `0009_infrastructure_baseline.sql`, then deploy the Worker.
5. Verify queue consumers and `gs-mail-dead-letter`; submit a test contact form and
   confirm D1 status changes from `queued` to `sent`.
6. Protect both admin hosts with the `admin-production` Access audience. The owner
   policy must list only `marstonr6@gmail.com` and `admin@goldshore.org`; retain an
   explicit deny fallback.
7. Confirm both public domains and both API domains return the same release version.
8. Only after live verification, retire preview routes/resources and satellite
   Workers using the checklist below.

## Acceptance checks

- `GET https://api.goldshore.ai/health` returns liveness without touching storage.
- `GET https://api.goldshore.org/ready` reports all required bindings ready.
- Unauthenticated access to either admin hostname is intercepted by Access.
- Both owner accounts reach `/app/dashboard`; other identities are denied.
- A form submission is persisted before queue publication and can be reconciled by
  its D1 mail-job record.
- An inbound test message is archived under `mail/inbound/` before forwarding.
- A transient Email Sending failure retries; exhausted messages reach the DLQ.
- A Worker Version URL rejects state-changing requests.

## Operator retirement checklist

These are manual dashboard candidates, not instructions for automated deletion:

- dedicated `gs-api-preview` / `gs-web-preview` Workers and preview DNS routes;
- `GOLDSHORE-ADMIN` preview KV;
- `gs-assets-preview`, `gs-risk-radar-raw-preview`, and
  `gs-telemetry-storage-preview` buckets;
- `goldshore-jobs-preview`, `gs-events-preview`, and `gs-mail-jobs-preview` queues;
- `gs-signals-evaluator-preview` Workflow;
- standalone `gs-admin-pages`, `gs-mail`, `gs-gateway`, `gs-agent`, and
  `gs-signals-prod` only after route and event-consumer parity is proven;
- duplicate `signals-evaluator` only after confirming it has no active triggers.

For every candidate, export configuration, inspect 30 days of request/event logs,
remove its routes and triggers, observe a rollback window, and then delete it in the
Cloudflare dashboard. `goldclaw` remains external until its MCP features are ported
or a deliberate external-service contract is documented.

## Secret ownership

Wrangler contains secret names only. Keep Access owner emails, OAuth client secrets,
webhook secrets, Turnstile, provider API keys, and delegated Google credentials in
Cloudflare dashboard-managed secrets. Never copy values into GitHub workflow YAML,
TOML variables, issue comments, or documentation.
