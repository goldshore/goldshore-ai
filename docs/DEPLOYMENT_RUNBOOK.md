# GoldShore two-app Cloudflare runbook

This is the operator source of truth for the consolidated GoldShore platform.
The repository contains exactly two deployable applications:

| Application | Runtime | Production hosts | Preview |
|---|---|---|---|
| `gs-web` | Astro SSR Cloudflare Worker-with-Assets | `goldshore.ai`, `www.goldshore.ai`, `goldshore.org`, `www.goldshore.org`, `admin.goldshore.ai`, `admin.goldshore.org` | `preview.goldshore.ai`, `admin-preview.goldshore.ai` |
| `gs-api` | Hono Cloudflare Worker | `api.goldshore.ai`, `api.goldshore.org` plus legacy host aliases routed into in-process modules | `api-preview.goldshore.ai` |

Do not create Pages deployments, separate admin frontends, satellite Workers, or
additional deploy workflows. `gs-web` owns every visual route, including
`/admin`; `gs-api` owns auth middleware, APIs, email events, queues, Workflows,
scheduled work, provider integrations, and storage.

## Configuration and deployment authority

Cloudflare Workers Builds is the only code deployment authority. Configure both
projects in the Cloudflare dashboard with the repository connection and the
`gs-control` build token. GitHub workflows named `deploy-gs-web.yml` and
`deploy-gs-api.yml` are intentionally verification-only.

Use Cloudflare's dashboard/WYSIWYG controls for custom domains, routes, Access,
IdPs, secret values, email routing, build connections, resource creation, and
resource retirement. The two app-local `wrangler.toml` files are the visible,
reviewable binding contracts consumed by Workers Builds. There are no hidden
Wrangler manifests. Binding declarations remain visible because a build can
remove omitted bindings; secret values and Access policies never enter Git.

Every production operation requires:

1. a reviewed issue or PR;
2. a named human operator and production approval;
3. before/after screenshots or redacted exports;
4. the Cloudflare audit-log event ID;
5. mirror-host validation and a rollback record.

## Domain mirroring

The `.ai` and `.org` production domains preserve the incoming host. They serve
the same release and theme, but canonical URLs, cookies, redirects, and OAuth
callbacks must remain host-aware. Verify the embedded release marker on every
web host and `/health` plus `/version` on both API hosts.

Cloudflare dashboard routes must match the visible manifest exactly. Do not
assign any production web hostname to a Pages project or legacy Worker. An
existing Pages project may be reused only after it is renamed as quarantined,
has no custom domain, has no active build connection, and is documented for a
future unrelated purpose.

## Production and preview bindings

`gs-web` may bind only static assets, Cloudflare Images, non-transactional UI
cache, session KV, and the public API origin variable. It must call `gs-api` for
forms, leads, CMS, admin, media, and integrations. It may not bind application
D1 databases, private R2 buckets, provider secrets, queues, or Workflows.

`gs-api` owns:

- D1: `PLATFORM_DB`, `AUDIT_DB`, `SIGNALS_DB`, `RISK_RADAR_DB`, `JOBS_DB`, and
  `PAPER_DB`;
- R2: `GS_ASSETS`, `TELEMETRY`, and `RISK_RADAR_R2`;
- KV: `KV`, `CONTROL_LOGS`, `RISK_RADAR_CACHE`, and `TRADING_KV`;
- Queues: `JOBS_QUEUE`, `EVENTS_QUEUE`, `MAIL_JOBS_QUEUE`, and
  `DEAD_LETTER_QUEUE`;
- Workflow: `GS_SIGNALS`, implemented by `SignalsEvaluator` in `gs-api`;
- Workers AI and dashboard-entered provider credentials; and
- the `fetch`, `scheduled`, `queue`, and `email` handlers exported from one
  Worker entry point.

Preview resources must be physically distinct. Reserved placeholder D1 IDs are
fail-closed markers and must be replaced with real preview IDs in a reviewed PR
before the preview build is activated. Never point a preview binding at a
production D1, R2 bucket, KV namespace, queue, dead-letter queue, or Workflow.

No Cloudflare Pipeline is required today. Introduce one only for a measured
streaming/analytics need, and first document producer, consumer, schema,
retention, replay, dead-letter behavior, cost, and prod/preview isolation in
`infra/Cloudflare/BINDINGS_MAP.md`.

## D1 requirements

Use `apps/gs-api/db/migrations/TEMPLATE.md` for every migration. A migration
must be forward-only, idempotent where possible, bounded, and paired with
verification and rollback/compensation notes. Apply it manually in the
Cloudflare D1 dashboard after approval; never from GitHub Actions.

Data ownership:

- `PLATFORM_DB`: CMS pages, forms, submissions, subscribers, business records,
  mailbox metadata, and user-facing operational state;
- `AUDIT_DB`: immutable authorization decisions, admin mutations, provider
  changes, approvals, deployments, rollbacks, and secret rotation metadata;
- `SIGNALS_DB` and `RISK_RADAR_DB`: derived signal and risk data;
- `JOBS_DB`: durable job state and idempotency metadata;
- `PAPER_DB`: paper-trading ledger and recommendations.

Before production migration, record preview results, table/index counts, query
plans for high-volume access paths, a D1 Time Travel bookmark, and application
compatibility. After migration, verify constraints and representative reads and
writes through `gs-api`. Never expose direct D1 operations to `gs-web`.

## R2 requirements

Follow `infra/Cloudflare/R2_POLICY.md`. Buckets are private by default; access
is through authenticated `gs-api` routes or short-lived signed URLs. Validate
content type, size, object prefix, and ownership before upload. Sanitize SVG and
other active content. Enable lifecycle rules separately for production and
preview, maintain an inventory, and retain critical originals outside a single
unversioned object. Never store OAuth tokens, passwords, or raw provider keys in
R2.

`GS_ASSETS` holds CMS/media objects, `TELEMETRY` holds restricted operational
telemetry, and `RISK_RADAR_R2` holds bounded raw risk inputs. Form submissions,
subscribers, mailbox state, and authorization state belong in D1, not R2.

## Identity, Access, and administration

Create two Cloudflare Access applications covering both admin hostnames and both
API hostnames with the same policy intent. Configure Google and GitHub as
interactive identity providers. Use Cloudflare Access service tokens only for
machine-to-machine traffic; never treat an inbound email header or an arbitrary
OAuth claim as an admin role.

Access authenticates identity. `gs-api` authorizes each operation using the
explicit RBAC matrix in `packages/auth/rbac.ts` and records denied and successful
mutations in `AUDIT_DB`.

Named principals:

| Principal | Role | Scope |
|---|---|---|
| `marstonr6@gmail.com` | `owner` | Full dashboard/API/mail/subscriber/CMS/integration/user/role/approval/audit access, including destructive operations and production execution |
| `admin@goldshore.org` | `admin` | Operational create/read/update/delete and rollout preparation; cannot delete users, manage owner roles, rotate root secret metadata, directly promote production, or execute the final approval step |

Map these exact verified email identities in Access and in the D1 identity/RBAC
migrations. Do not grant access by email domain alone. Require MFA at the IdP,
short Access sessions for admin hosts, reauthentication for destructive or
secret-related actions, and two-person approval for production rollout,
rollback, role elevation, and root-secret rotation.

The admin UI must expose only capabilities returned by `gs-api`; hiding a button
is not authorization. The owner/admin dashboard covers visual configuration,
API middleware, HostGator mailbox metadata, subscribers, business CMS, secret
name/rotation metadata, integrations, build status, rollout, rollback, and audit
history. Secret values are write-only in the Cloudflare dashboard and are never
read back into the UI.

## Mail and forms

HostGator remains the mailbox host. Cloudflare Email Routing and the `gs-api`
`email()` handler may receive/route edge events and metadata but must not become
a second mailbox system. Form routes persist validated submissions to
`PLATFORM_DB`, enqueue notification work through `MAIL_JOBS_QUEUE`, and provide
idempotency and dead-letter handling in `gs-api`. Never create a mail Worker.

Configure prod and preview recipient allowlists, blocked senders, notification
addresses, sender identity, Turnstile, queue bindings, and dead-letter queues in
their separate dashboard environments. Avoid logging message bodies or secrets.

## External services and AI providers

GoldClaw/MCP is an external, incomplete service behind a curated `gs-api`
connector. `gs-web` never calls it directly. The connector uses an allowlisted
base URL, encrypted token storage, timeouts, bounded retries, circuit breaking,
schema validation, redacted logs, human approval for mutations, and an audit
record. Do not add a GoldClaw service binding until a real deployed Worker and a
documented service contract exist.

Google Business Profile uses OAuth authorization code plus PKCE, exact redirect
URIs, minimal scopes, encrypted refresh tokens, ownership verification, and a
human production-consent flag. GitHub and Cloudflare administrative automation
is similarly allowlisted and approval-gated.

OpenAI integrations use the Responses API, structured schemas, stable safety
identifiers, explicit tool allowlists, bounded output, evaluations, and human
approval for consequential actions. Anthropic integrations use the Messages
API through the provider adapter, an approved model list, tool schemas, prompt
injection defenses, PII redaction, retries with jitter, usage/cost telemetry,
and fail-closed gateway policy outside preview. Provider keys exist only as
`gs-api` dashboard secrets.

## Secret inventory

The required secret names are listed in `infra/Cloudflare/BINDINGS_MAP.md` and
the redacted inventory exporter. Verify name, environment, consumer, upstream
owner, created/rotated date, expiration, and runbook link. Never export values.
Remove duplicate or unused names only after all consumers are traced, the
upstream credential is revoked, and a 30-day quarantine has elapsed.

## Quarantine and reuse

For every unclear Worker, Pages project, KV namespace, D1 database, R2 bucket,
queue, Workflow, route, Access app, or secret:

1. inventory consumers and traffic;
2. remove routes/producers/build triggers without deleting data;
3. label it `quarantine`, owner, ticket, and retirement date;
4. monitor for 30 days;
5. either document and reuse it for a defined two-app purpose or delete it in
   the dashboard with backup/rollback evidence.

Do not repurpose production data stores merely because their names are unclear.
