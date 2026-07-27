# GS-WEB-PROD and Cloudflare Canonical Source of Truth

Status: Canonical draft
Owner: GSHQ
Cloudflare account display title: **Gold Shore Labs**
Repository authority: `marzton/goldshore-ai`
Canonical production applications: `gs-web-prod`, `gs-api-prod`

## 1. Naming decision

Keep the Cloudflare account/team display title **Gold Shore Labs**. Do not rename the Cloudflare account to a department, product, Worker, repository, or temporary campaign name.

Use these layers consistently:

- Enterprise / vendor account title: `Gold Shore Labs`
- Human application title: `Gold Shore Labs — Web — Production`
- Worker/service identifier: `gs-web-prod`
- Repository package: `@goldshore/gs-web`
- Repository path: `apps/gs-web`
- Environment key: `prod`
- Public brand shown to website users: `Gold Shore`

The same pattern applies to the API:

- Human application title: `Gold Shore Labs — API — Production`
- Worker/service identifier: `gs-api-prod`
- Repository package: `@goldshore/gs-api`
- Repository path: `apps/gs-api`

## 2. Consolidation rule

Gold Shore Labs has only two canonical in-repository production deployment targets:

1. `gs-web-prod` — all browser-delivered pages and user interfaces.
2. `gs-api-prod` — all APIs, auth middleware, agents, jobs, queues, mail handlers, integrations, service orchestration, and control endpoints.

The following names are capabilities or migration aliases, not default standalone Workers:

- `gs-admin`
- `gs-gateway`
- `gs-platform`
- `gs-agent`
- `gs-mail`
- `gs-control`
- `gs-trading`
- `gs-signals`

A new Worker requires a documented security, compliance, billing, data-isolation, or lifecycle boundary.

## 3. Canonical Worker and Wrangler names

| Environment | Web Worker | API Worker | Wrangler selector |
| --- | --- | --- | --- |
| Production | `gs-web-prod` | `gs-api-prod` | `--env prod` |
| Staging | `gs-web-staging` | `gs-api-staging` | `--env staging` |
| Preview | `gs-web-preview` | `gs-api-preview` | `--env preview` |
| Development | `gs-web-dev` | `gs-api-dev` | local/miniflare or explicit `--env dev` |

Do not create alternate synonyms such as `production`, `live`, `main`, `goldshore-web-prod`, or `goldshore-api-prod`.

## 4. GS-WEB-PROD runtime contract

### Worker

- Base Wrangler name: `gs-web`
- Production deployment name: `gs-web-prod`
- Runtime: Cloudflare Worker with static assets
- Build owner: GitHub Actions from `marzton/goldshore-ai`
- Source: `apps/gs-web`
- Static output: `apps/gs-web/dist`
- Assets binding: `ASSETS`
- Workers.dev exposure: disabled for production

### Production routes

`gs-web-prod` owns browser-facing traffic for:

- `goldshore.ai/*`
- `goldshore.org/*`
- `admin.goldshore.ai/*`
- `admin.goldshore.org/*`

Until an explicit separation milestone is approved, `goldshore.ai` and `goldshore.org` must serve the same build, route set, navigation, page templates, content version, and release SHA.

The `www` hostnames may redirect to the apex, but the apex sites must remain mirrors:

- `www.goldshore.ai/*` → `https://goldshore.ai/$1`
- `www.goldshore.org/*` → `https://goldshore.org/$1` or the approved canonical apex without changing page state

Do not introduce organization-specific content on `.org` until a separation ADR identifies the owner, deployment target, migration date, and rollback plan.

### Bindings

| Binding | Type | Production resource | Purpose |
| --- | --- | --- | --- |
| `ASSETS` | Worker assets | `apps/gs-web/dist` | Astro/static site delivery |
| `KV` | KV namespace | existing production GS Web KV | application configuration/cache |
| `SESSION` | KV namespace | existing session namespace | web session state |
| `PLATFORM_DB` | D1 | `gs_platform_db` | shared platform records needed by the web UI |
| `GS_ASSETS` | R2 | `gs-assets` | uploaded and managed assets |
| `IMAGES` | Images binding | Cloudflare Images | image delivery/transformation |

### Variables

| Variable | Classification | Purpose |
| --- | --- | --- |
| `ENV=production` | non-secret | runtime environment selector |
| `PUBLIC_API=https://api.goldshore.ai` | non-secret | canonical API origin |
| `CLOUDFLARE_TEAM_DOMAIN=goldshore.cloudflareaccess.com` | non-secret | Access issuer/team domain |
| `CLOUDFLARE_ACCESS_AUDIENCE` | non-secret identifier or managed secret | expected Admin Access AUD |
| `CONTACT_NOTIFICATION_EMAILS` | restricted configuration | form notification recipients |
| `MAILCHANNELS_SENDER_NAME=Gold Shore Labs` | non-secret | canonical sender display name |

### Secrets

The following values must be provisioned remotely and never committed:

- `MAILCHANNELS_SENDER_EMAIL`
- any Access service-token client secret
- API/provider secrets
- webhook signing secrets
- OAuth client secrets
- database encryption keys
- integration master keys

Recommended sender identity:

- Display name: `Gold Shore Labs`
- Sender address: `hello@goldshore.ai`

## 5. DNS and subdomain ownership

### Web-owned hostnames

| Hostname | Owner | Access state |
| --- | --- | --- |
| `goldshore.ai` | `gs-web-prod` | public |
| `goldshore.org` | `gs-web-prod` | public; mirrored with `.ai` |
| `admin.goldshore.ai` | `gs-web-prod` | Cloudflare Access |
| `admin.goldshore.org` | `gs-web-prod` | Cloudflare Access |
| `preview.goldshore.ai` | `gs-web-preview` | Cloudflare Access |
| `admin-preview.goldshore.ai` | `gs-web-preview` | Cloudflare Access |

### API-owned hostnames

| Hostname | Owner | Role |
| --- | --- | --- |
| `api.goldshore.ai` | `gs-api-prod` | canonical API |
| `api.goldshore.org` | `gs-api-prod` | API alias where required |
| `gw.goldshore.ai` | `gs-api-prod` | gateway routes |
| `agent.goldshore.ai` | `gs-api-prod` | agent routes |
| `mail.goldshore.ai` | `gs-api-prod` | inbound mail/events |
| `ops.goldshore.ai` | `gs-api-prod` | control plane APIs |
| `trading.goldshore.ai` | `gs-api-prod` and/or web routes by path | trading integration |
| `dashboard.goldshore.ai` | canonical web/API pair by path | protected dashboard alias |
| `mcp.goldshore.ai` | explicit external MCP service until folded into `gs-api` | agent tooling |

A hostname is a route, not proof that a separate Worker should exist.

## 6. GS-API authentication mechanism

`gs-api-prod` uses Cloudflare Access JWT validation for protected routes.

### Human authentication

Allowed methods may include:

- Google Workspace
- GitHub OAuth
- dedicated GitHub deployment identity
- email OTP for explicitly allowed addresses

Public paths should remain separately bypassed rather than weakening the protected application:

- `/`
- `/health`
- `/status`
- `/version`
- approved OAuth callbacks
- approved public form submission endpoints

Protected paths include administrative, internal, system, user, media, page-management, template-management, and AI-control routes.

### Machine authentication

Non-interactive callers use a Cloudflare Access service token and send:

- `CF-Access-Client-Id`
- `CF-Access-Client-Secret`

GitHub Actions stores the values as:

- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

Workers validate the Access JWT issuer against:

- Team domain: `goldshore.cloudflareaccess.com`
- Audience: the Access application AUD assigned to the protected API surface

The Access application AUD and Worker configuration must be updated together. Do not create a second Access application solely to change a display name.

## 7. CF/GH AI MCP agent designation

Canonical human designation:

- **Application name:** `Gold Shore Labs — MCP Agent`
- **Access application:** `Gold Shore Labs — Access — MCP`
- **Service-token name:** `Gold Shore Labs — CF/GH AI MCP Agent — Production`
- **GitHub secret names:** `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`
- **Cloudflare API management token title:** `Gold Shore Labs — Cloudflare — Access Automation — Production — GitHub Actions`
- **GitHub workflow:** `Setup CF Agent Access`
- **MCP hostname:** `mcp.goldshore.ai`

The current workflow-created service-token name `goldshore-agents` is a legacy machine title. Keep it operational until the next controlled rotation, then create the replacement using the canonical service-token name above and propagate its credentials atomically.

Never rename or revoke a service token without first checking every Access policy that references its token UUID.

## 8. Queues, jobs, workflows, and services

### Canonical binding names

Binding names are uppercase code contracts and should be stable:

- `JOBS_QUEUE`
- `EVENTS_QUEUE`
- `MAIL_JOBS_QUEUE`
- `DEAD_LETTER_QUEUE`
- `AUTH_SESSION`
- `AI`
- `PLATFORM_DB`
- `AUDIT_DB`
- `SIGNALS_DB`
- `JOBS_DB`
- `GS_ASSETS`
- `TELEMETRY`

### Canonical physical resource names

Physical resources use lowercase kebab-case:

- `gs-jobs`
- `gs-events`
- `gs-mail-jobs`
- `gs-mail-dead-letter`
- `gs-assets`
- `gs-telemetry-storage`
- `gs-platform-db` where a platform permits kebab-case, otherwise existing `gs_platform_db`

Legacy physical name `goldshore-jobs` should be treated as migration debt; do not create another duplicate queue merely to rename it. Rename only through a producer/consumer migration plan.

### Service bindings

Target state removes service bindings to retired standalone Workers:

- `AGENT -> gs-agent`
- `GS_MAIL -> gs-mail`
- `GOLDSHORE_AI -> goldshore-ai`

Before removal, search calling code and confirm the behavior has been absorbed into `gs-api`. New code must call local modules, queues, workflows, or stable API routes rather than extending legacy service dependencies.

### Cloudflare Workflows

A workflow binding should use:

- Binding: uppercase capability name, such as `GS_SIGNALS`
- Workflow name: lowercase kebab-case, such as `gs-signals-evaluator`
- Class name: PascalCase, such as `SignalsEvaluator`

Avoid attaching a workflow permanently to a legacy script such as `gs-signals-prod` after its implementation has moved into `gs-api-prod`.

## 9. Email configuration

Target ownership is `gs-api-prod`.

Canonical configuration:

- Sender display: `Gold Shore Labs`
- Sender email secret: `MAILCHANNELS_SENDER_EMAIL`
- Notification recipients: `CONTACT_NOTIFICATION_EMAILS`
- Mail queue binding: `MAIL_JOBS_QUEUE`
- Dead-letter binding: `DEAD_LETTER_QUEUE`
- Inbound route: `mail.goldshore.ai`

Legacy mail controls to preserve during migration:

- `MAIL_BLOCKED_SENDERS`
- `MAIL_ALLOWED_RECIPIENTS`
- `MAIL_FORWARD_TO`

Inbound Cloudflare Email Routing cannot depend on an interactive Access login. Validate inbound signatures, recipients, sender policy, message size, and content type inside the Worker.

## 10. Cloudflare Access login portal UX

Team domain:

- `https://goldshore.cloudflareaccess.com`

Brand title:

- `Gold Shore Labs`

Recommended portal design:

1. Centered Gold Shore mark with restrained dark background and high-contrast white/gold typography.
2. Heading: `Gold Shore Labs`.
3. Subheading: `Secure access to Gold Shore systems`.
4. Login choices shown only when applicable: Google Workspace, GitHub, and email OTP.
5. No product marketing, ads, campaign links, or public-site navigation inside the secure login surface.
6. Clear environment indicator for preview/staging applications.
7. Footer links limited to privacy, access support, and security reporting.
8. Error copy should identify the failed access condition without disclosing internal policy details.
9. Successful login returns users to the originally requested path.
10. Session behavior should be consistent across Admin, API, Operations, Trading, Preview, and MCP applications.

The Access portal is an identity boundary, not the Gold Shore marketing homepage. Its experience should communicate security, legitimacy, and minimum friction.

## 11. Administrative web route plan

Canonical host pair:

- `admin.goldshore.ai`
- `admin.goldshore.org`

Both hostnames route to the same `gs-web-prod` build and use the same Access application until an approved separation milestone.

Required routes:

- `/login`
- `/dashboard`
- `/apps`
- `/apps/[app]`
- `/settings`
- `/settings/profile`
- `/settings/security`
- `/settings/integrations`
- `/settings/notifications`
- `/settings/audit`

### Page templates

- `AdminLoginPage` — branded handoff/status page for Access; does not replace Cloudflare Access authentication.
- `AdminDashboardPage` — system status, deployments, alerts, approvals, work queues, and recent audit activity.
- `AdminAppsIndexPage` — application registry for GS Web, GS API, GSMI, GS Works, Risk Radar, BanProof, and approved external apps.
- `AdminAppDetailPage` — routes, environment, repository, Worker, bindings, health, owner, and deployment history.
- `AdminSettingsPage` — profile, security, integrations, notifications, naming registry, and audit controls.
- `AdminErrorPage` — safe error surface without stack traces or secrets.

## 12. Planned GS-Web file hierarchy

```text
apps/gs-web/
├── src/
│   ├── layouts/
│   │   ├── GoldShoreShell.astro
│   │   ├── AdminShell.astro
│   │   └── AuthShell.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── admin/
│   │   │   ├── index.astro
│   │   │   ├── login.astro
│   │   │   ├── dashboard.astro
│   │   │   ├── apps/
│   │   │   │   ├── index.astro
│   │   │   │   └── [app].astro
│   │   │   └── settings/
│   │   │       ├── index.astro
│   │   │       ├── profile.astro
│   │   │       ├── security.astro
│   │   │       ├── integrations.astro
│   │   │       ├── notifications.astro
│   │   │       └── audit.astro
│   │   └── apps/
│   ├── components/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── navigation/
│   │   └── system/
│   ├── config/
│   │   ├── navigation.ts
│   │   ├── applications.ts
│   │   └── domains.ts
│   ├── lib/
│   │   ├── access.ts
│   │   ├── api-client.ts
│   │   └── environment.ts
│   └── styles/
│       ├── global.css
│       ├── gs-shell.css
│       └── admin.css
├── public/
│   ├── _headers
│   └── _routes.json
└── wrangler.toml
```

Host-based routing should map `admin.goldshore.ai/*` and `admin.goldshore.org/*` to the `/admin/*` route tree without duplicating templates.

## 13. Planned GS-API file hierarchy

```text
apps/gs-api/
├── src/
│   ├── index.ts
│   ├── middleware/
│   │   ├── access.ts
│   │   ├── audit.ts
│   │   ├── cors.ts
│   │   └── errors.ts
│   ├── routes/
│   │   ├── public/
│   │   │   ├── health.ts
│   │   │   ├── status.ts
│   │   │   └── forms.ts
│   │   ├── admin/
│   │   │   ├── dashboard.ts
│   │   │   ├── apps.ts
│   │   │   ├── settings.ts
│   │   │   ├── deployments.ts
│   │   │   └── audit.ts
│   │   ├── agent.ts
│   │   ├── gateway.ts
│   │   ├── mail.ts
│   │   ├── media.ts
│   │   ├── pages.ts
│   │   ├── templates.ts
│   │   └── trading.ts
│   ├── services/
│   │   ├── applications/
│   │   ├── auth/
│   │   ├── deployments/
│   │   ├── integrations/
│   │   ├── mail/
│   │   ├── media/
│   │   ├── queues/
│   │   └── settings/
│   ├── queues/
│   │   ├── jobs.ts
│   │   ├── events.ts
│   │   ├── mail.ts
│   │   └── dead-letter.ts
│   ├── workflows/
│   │   └── signals-evaluator.ts
│   ├── durable-objects/
│   │   └── auth-session.ts
│   ├── repositories/
│   │   ├── platform.ts
│   │   ├── audit.ts
│   │   ├── jobs.ts
│   │   └── signals.ts
│   ├── schemas/
│   ├── types/
│   └── config/
└── wrangler.toml
```

## 14. Required admin API routes

```text
GET    /v1/admin/dashboard
GET    /v1/admin/apps
GET    /v1/admin/apps/:app
PATCH  /v1/admin/apps/:app
GET    /v1/admin/settings
PATCH  /v1/admin/settings
GET    /v1/admin/settings/security
PATCH  /v1/admin/settings/security
GET    /v1/admin/settings/integrations
PATCH  /v1/admin/settings/integrations
GET    /v1/admin/audit
GET    /v1/admin/deployments
```

Every administrative mutation must record actor, timestamp, Access identity, request ID, affected resource, before/after state, and outcome in the audit store.

## 15. Naming audit rules

| Element | Convention | Example |
| --- | --- | --- |
| Cloudflare account title | human title | `Gold Shore Labs` |
| Worker | lowercase kebab-case + env | `gs-web-prod` |
| Wrangler env | short lowercase | `prod` |
| Binding | uppercase snake case | `PLATFORM_DB` |
| Queue | lowercase kebab-case | `gs-mail-jobs` |
| Workflow | lowercase kebab-case | `gs-signals-evaluator` |
| Workflow class | PascalCase | `SignalsEvaluator` |
| D1 database | existing snake_case retained; new names documented | `gs_platform_db` |
| R2 bucket | lowercase kebab-case | `gs-assets` |
| Access app | human title | `Gold Shore Labs — Access — Admin` |
| IdP title | human title | `Gold Shore Labs — IdP — GitHub` |
| GitHub secret | uppercase snake case | `CF_ACCESS_CLIENT_SECRET` |
| API token title | human title with issuer/purpose/env/actor | `Gold Shore Labs — Cloudflare — Deploy Web — Production — GitHub Actions` |
| Route/module | lowercase path | `/v1/admin/apps` |
| Template/component | PascalCase | `AdminDashboardPage` |

Keys and secret names are contracts. Rename them only through a compatibility migration. Secret values must never appear in source control, logs, issue bodies, PR descriptions, or documentation.

## 16. Immediate migration sequence

1. Keep Cloudflare account title `Gold Shore Labs`.
2. Confirm live production routes point only to `gs-web-prod` and `gs-api-prod` except documented external products.
3. Preserve existing Access application IDs and AUD values; rename display titles in place later.
4. On the next service-token rotation, replace `goldshore-agents` with `Gold Shore Labs — CF/GH AI MCP Agent — Production`.
5. Audit calling code for `AGENT`, `GS_MAIL`, and `GOLDSHORE_AI` before removing legacy service bindings.
6. Separate preview data from production where preview currently reuses production KV, D1, R2, queues, or Durable Objects.
7. Standardize sender display name from `GoldShore` to `Gold Shore Labs` without changing the verified sender address.
8. Implement the shared Admin route tree in `gs-web` and Admin API namespace in `gs-api`.
9. Enforce identical mirror releases for `goldshore.ai` and `goldshore.org` in CI.
10. Archive or classify repositories that exist only for retired standalone Workers.

## 17. Change control

Any change to the Cloudflare account title, canonical Workers, Access applications, AUDs, service-token names, routes, bindings, queues, domains, IdPs, or admin path structure must update this file and `docs/architecture/GOLD-SHORE-NAMING-SOURCE-OF-TRUTH.md` in the same pull request.
