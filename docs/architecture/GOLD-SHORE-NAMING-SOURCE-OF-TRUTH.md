# Gold Shore Naming Source of Truth

Status: Canonical draft
Owner: GSHQ
Repository authority: `marzton/goldshore-ai`

## 1. Purpose

This file defines the canonical names used for Gold Shore applications, repositories, Cloudflare Workers, Wrangler environments, Access applications, identity providers, API tokens, cloud projects, third-party developer apps, and internal divisions.

The goal is simplification. Gold Shore should operate from a small set of stable application names instead of creating a new repository, Worker, token title, or cloud project for every function.

## 2. Core rule

`GS` is shorthand for Gold Shore and, where legal identity is required, Gold Shore LLC.

Canonical platform applications:

- `gs-web` — public web surface and browser-delivered application UI
- `gs-api` — unified API, automation, queue, scheduled, integration, mail, agent, and backend control surface

These are the only canonical production application deploy targets inside `goldshore-ai`.

`gs-admin`, `gs-gateway`, `gs-platform`, `gs-agent`, `gs-mail`, `gs-control`, `gs-trading`, and similar legacy names are capability names or migration aliases, not new default deploy targets.

## 3. Human titles and machine identifiers

Use a human-readable title when a vendor asks for an application, token, identity provider, or integration name.

Format:

`Gold Shore — <Purpose> — <Environment>`

Examples:

- `Gold Shore — Web — Production`
- `Gold Shore — API — Production`
- `Gold Shore — API Deploy — GitHub Actions`
- `Gold Shore — Meta Marketing — Production`
- `Gold Shore — Cloudflare Access — Google Workspace`

Use a lowercase kebab-case machine identifier when the platform requires a slug, Worker name, repository path, cloud project ID, or service name.

Format:

`gs-<application-or-capability>[-<environment>]`

Examples:

- `gs-web-prod`
- `gs-web-preview`
- `gs-api-prod`
- `gs-api-staging`
- `gs-marketing-meta-prod`

Do not mirror a human title verbatim into a machine identifier unless the vendor explicitly requires exact string equality.

## 4. Application registry

| Canonical application | Human title | Machine base name | Owns |
| --- | --- | --- | --- |
| Web | `Gold Shore — Web` | `gs-web` | Public site, dashboards, admin UI, client UI, documentation, browser routes |
| API | `Gold Shore — API` | `gs-api` | APIs, auth middleware, AI routes, mail, queues, cron, integrations, webhooks, control endpoints |

### Retired standalone application names

The following must not be created as new standalone production applications unless this file is amended first:

- `gs-admin`
- `gs-gateway`
- `gs-platform`
- `gs-agent`
- `gs-mail`
- `gs-control`
- `gs-trading`
- `gs-signals`

Their functions belong under `gs-web` or `gs-api`:

| Capability | Canonical owner |
| --- | --- |
| Admin UI | `gs-web` |
| Admin API | `gs-api` |
| Gateway and routing | `gs-api` |
| Platform data and registry | `gs-api` |
| Agent routes and queue handlers | `gs-api` |
| Mail handlers and dispatch | `gs-api` |
| Trading API and OAuth | `gs-api` |
| Trading dashboard | `gs-web` |
| Signals UI | `gs-web` |
| Signals jobs and APIs | `gs-api` |

## 5. Wrangler and Worker naming

Wrangler application package names remain stable:

- `@goldshore/gs-web`
- `@goldshore/gs-api`

Worker deployment names:

| Environment | Web Worker | API Worker |
| --- | --- | --- |
| Production | `gs-web-prod` | `gs-api-prod` |
| Staging | `gs-web-staging` | `gs-api-staging` |
| Preview | `gs-web-preview` | `gs-api-preview` |
| Local development | `gs-web-dev` | `gs-api-dev` |

Rules:

1. Never deploy a bare production Worker named only `gs-web` or `gs-api` unless intentionally retained as a non-routed development target.
2. Production routes must point only to `gs-web-prod` or `gs-api-prod`.
3. Environment names are limited to `dev`, `preview`, `staging`, and `prod`.
4. Do not introduce `production` as a second synonym for `prod`.
5. A new Worker requires an explicit exception recorded in this file and `infra/INFRASTRUCTURE.md`.

## 6. Domain ownership

### `gs-web-prod`

- `goldshore.ai`
- `goldshore.org`
- `admin.goldshore.ai`
- `admin.goldshore.org`
- browser-delivered dashboards and public interfaces

### `gs-api-prod`

- `api.goldshore.ai`
- `gw.goldshore.ai`
- `agent.goldshore.ai`
- `mail.goldshore.ai`
- `ops.goldshore.ai`
- `trading.goldshore.ai`
- backend routes for dashboard aliases

A hostname does not justify a separate Worker. Hostnames are routes into one of the two canonical applications.

## 7. Cloudflare Access application names

Canonical title format:

`Gold Shore — Access — <Surface>`

Canonical names to migrate toward:

- `Gold Shore — Access — Admin`
- `Gold Shore — Access — Operations`
- `Gold Shore — Access — Trading`
- `Gold Shore — Access — API`
- `Gold Shore — Access — Gateway`
- `Gold Shore — Access — Preview`
- `Gold Shore — Access — MCP`
- `Gold Shore — Access — Signals`

Existing names such as `GoldShore-Admin-ZT`, `Goldshore Ops`, `GoldShore-Trading-ZT`, `Goldshore API`, and `Goldshore Gateway` are legacy display names. Do not duplicate applications merely to rename them. Rename in place only after confirming policies, audiences, service tokens, and application IDs remain intact.

## 8. Identity provider names

Canonical title format:

`Gold Shore — IdP — <Provider>`

Use:

- `Gold Shore — IdP — Google Workspace`
- `Gold Shore — IdP — GitHub`
- `Gold Shore — IdP — GitHub Deploy`
- `Gold Shore — IdP — Email OTP`

Machine keys may remain:

- `google_workspace`
- `github`
- `github_goldshore_deploy`
- `email_otp`

Display titles and machine keys are different layers and should not be forced into one identical string.

## 9. API token naming

Canonical title format:

`Gold Shore — <Platform> — <Purpose> — <Environment> — <Actor>`

Examples:

- `Gold Shore — Cloudflare — Deploy Web — Production — GitHub Actions`
- `Gold Shore — Cloudflare — Deploy API — Production — GitHub Actions`
- `Gold Shore — GitHub — Repository Automation — Production — GSHQ`
- `Gold Shore — Meta — Marketing API — Production — GS Marketing`
- `Gold Shore — Google Cloud — CI Deploy — Production — GitHub Actions`

Rules:

1. Titles identify issuer, purpose, environment, and actor.
2. Tokens are not named after individual experiments.
3. Tokens are scoped to the least privilege required.
4. Token names are recorded in a secret registry, but token values are never committed.
5. One token may serve multiple routes only when the permission boundary is truly shared.

## 10. Third-party developer application naming

Use stable capability names instead of campaign names.

Examples:

- `Gold Shore — Meta Marketing`
- `Gold Shore — Google Workspace`
- `Gold Shore — Google Cloud`
- `Gold Shore — GitHub Automation`
- `Gold Shore — Stripe Platform`
- `Gold Shore — OpenAI Platform`

Campaigns, ad accounts, datasets, and projects live beneath the application. Do not create a new developer app for each campaign.

Recommended Meta hierarchy:

- Developer app: `Gold Shore — Meta Marketing`
- Business function: `GS Marketing`
- Sub-capabilities: `GS Ads`, `GS Campaigns`, `GS Social`, `GS Analytics`
- Individual campaigns: named by client, objective, and date, not as new Gold Shore applications

## 11. Repository policy

Canonical source repository:

- `marzton/goldshore-ai`

Canonical application paths:

- `apps/gs-web`
- `apps/gs-api`

Canonical shared paths:

- `packages/*`
- `infra/*`
- `docs/*`

Existing Gold Shore repositories should be classified as one of:

- canonical monorepo
- external product
- client project
- archive
- migration source

A repository must not exist solely because a Cloudflare Worker once existed. Legacy Worker repositories should be migrated into `goldshore-ai`, archived, or explicitly declared external.

## 12. Organizational names are not deployable services

Names such as these describe business ownership and reporting structure:

- GSHQ
- GS Operations
- GS Labs
- GS Marketing
- GS Research
- GS Development
- GS Security
- GS Media Intelligence
- GS Works

They do not automatically become repositories, Workers, Google Cloud projects, or developer applications.

Create technical resources only when there is a real security, billing, lifecycle, compliance, or deployment boundary.

## 13. Cost-control test

Before creating a repository, Worker, cloud project, developer app, token, or Access application, answer:

1. Can this be a route, module, package, queue, binding, or configuration inside `gs-web` or `gs-api`?
2. Does it require independent billing?
3. Does it require independent credentials or legal ownership?
4. Does it require a separate deployment lifecycle?
5. Does it process a materially different data classification?

If only the first answer is yes, keep it inside the monorepo and existing application.

## 14. Immediate canonical state

The desired simplified state is:

```text
marzton/goldshore-ai
├── apps/gs-web      -> gs-web-{environment}
├── apps/gs-api      -> gs-api-{environment}
├── packages         -> shared code
├── infra            -> Cloudflare and cloud desired state
└── docs             -> organizational and technical source of truth
```

Everything else must be justified as an external product, client repository, temporary migration source, or archive.

## 15. Change control

Any change to canonical application names, Worker names, environment suffixes, Access titles, identity provider titles, or token naming patterns must update this file in the same pull request.
