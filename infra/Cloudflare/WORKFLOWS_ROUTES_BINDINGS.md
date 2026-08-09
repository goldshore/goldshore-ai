# Gold Shore AI — Website Workflows, Subdomain Routes & Required Bindings

> Operational manifest for the active `marzton/goldshore-ai` production monorepo.
>
> **Source-of-truth order:** current code → app `wrangler.toml` → GitHub workflows → infrastructure docs → live Cloudflare state.
>
> This repository is intentionally a **two-deployable architecture**:
>
> - `apps/gs-web` — Astro SSR frontend Worker.
> - `apps/gs-api` — unified backend/API Worker.
>
> Do **not** recreate legacy satellite Workers (`gs-agent`, `gs-gateway`, `gs-mail`, `gs-control`, standalone admin, etc.) merely because older documentation still names them. Extend `gs-web` or `gs-api` unless the architecture contract is explicitly changed.

---

## 1. Deployment / website workflows

### `gs-web`

**Code:** `apps/gs-web`

**Runtime:** Cloudflare Worker + Assets (Astro SSR), not Cloudflare Pages.

**Canonical Worker config:** `apps/gs-web/wrangler.toml`

**GitHub workflow:** `.github/workflows/deploy-gs-web.yml`

**Workflow behavior:**

- Runs for PRs and pushes to `main` when web/shared build inputs change.
- GitHub Actions performs **build verification only**.
- Authoritative deployment is the **Cloudflare Workers Build git integration**.
- Do not reintroduce the removed a static-site deploy path; `gs-web` requires SSR Worker output.

**Build validation:**

```bash
pnpm install --frozen-lockfile
pnpm --filter @goldshore/gs-web build
```

Current workflow uses the repo-level `pnpm build:pages` build verification command. Despite the historical command name, production delivery is a Worker deployment, not Pages.

### `gs-api`

**Code:** `apps/gs-api`

**Runtime:** Cloudflare Worker.

**Canonical Worker config:** `apps/gs-api/wrangler.toml`

**GitHub workflow:** `.github/workflows/deploy-gs-api.yml`

**Workflow behavior:**

- Push to `main` → `prod` environment.
- Push to `stage` → `preview` environment.
- Installs with frozen pnpm lockfile.
- Builds `@goldshore/gs-api`.
- Applies production D1 migration(s) when required by workflow.
- Bulk-provisions allowed Worker secrets from GitHub Actions secrets.
- Deploys with Wrangler using the matching environment.
- Production deployment must pass `https://api.goldshore.ai/health` health check.

Required GitHub Actions deployment secrets currently include:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN`
- `JWT_SECRET`
- `ACCESS_CLIENT_SECRET`
- `CONTROL_SYNC_TOKEN`

Optional/feature secrets provisioned when present include:

- `INTEGRATION_MASTER_KEY`
- `MAILCHANNELS_SENDER_EMAIL`
- `OPENAI_API_KEY`
- `GOOGLE_API_GEMINI` → runtime `GEMINI_API_KEY`

Never commit secret values into Wrangler vars, workflow YAML, docs, examples, or browser code.

---

## 2. Current production hostname ownership

### `gs-web-prod`

The `gs-web` Worker currently owns these production web routes via `[env.prod].routes`:

| Host / route | Zone | Purpose / owner |
|---|---|---|
| `goldshore.ai/*` | `goldshore.ai` | Primary public website |
| `goldshore.org/*` | `goldshore.org` | Public foundation/org website surface |
| `admin.goldshore.ai/*` | `goldshore.ai` | Admin/cockpit UI surface inside `gs-web` |
| `admin-preview.goldshore.ai/*` | `goldshore.ai` | Admin preview surface |
| `admin.goldshore.org/*` | `goldshore.org` | Org admin surface |
| `risk.goldshore.ai/*` | `goldshore.ai` | Risk Radar UI surface |
| `risk.goldshore.org/*` | `goldshore.org` | Org Risk Radar UI surface |

### `gs-api` / production environment

The unified API Worker currently owns these routes via `[env.prod].routes`:

| Host / route | Zone | Logical surface |
|---|---|---|
| `api.goldshore.ai/*` | `goldshore.ai` | Canonical API |
| `agent.goldshore.ai/*` | `goldshore.ai` | Agent/API behavior implemented inside `gs-api` |
| `mail.goldshore.ai/*` | `goldshore.ai` | Mail/API behavior implemented inside `gs-api` |
| `ops.goldshore.ai/*` | `goldshore.ai` | Operations/control routes implemented inside `gs-api` |
| `trading.goldshore.ai/*` | `goldshore.ai` | Trading routes implemented inside `gs-api` |
| `dashboard.goldshore.ai/*` | `goldshore.ai` | Dashboard API/redirect surface |
| `dash.goldshore.ai/*` | `goldshore.ai` | Dashboard alias surface |
| `gw.goldshore.ai/*` | `goldshore.ai` | Gateway-compatible surface now owned by `gs-api` |
| `api.goldshore.org/*` | `goldshore.org` | Org API surface |

### Preview routes

`gs-web` preview custom domains:

- `preview.goldshore.ai`
- `admin-preview.goldshore.ai`

`gs-api` preview includes `api-preview.goldshore.ai/*` and retains compatibility routes defined in the current Wrangler preview environment. Always inspect the current `[env.preview]` block before changing preview routing.

---

## 3. `gs-web` required bindings

### Assets

| Binding | Resource |
|---|---|
| `ASSETS` | Astro Worker Assets from `./dist` |

### KV

| Binding | Resource / ID |
|---|---|
| `KV` | `5f13370575784c9dacff522121104cb3` |
| `SESSION` | `09ae2ffbffe24e628c9538c8129dfe33` |

### D1

| Binding | Database | ID |
|---|---|---|
| `PLATFORM_DB` | `gs_platform_db` | `9703574e-adb7-481e-8d98-96f8ce5f8a90` |

### R2

| Binding | Bucket |
|---|---|
| `GS_ASSETS` | `gs-assets` (prod) / `gs-assets-preview` (preview) |

### Cloudflare Images

| Binding | Purpose |
|---|---|
| `IMAGES` | Cloudflare Images binding in prod/preview environments |

### Important vars

- `ENV`
- `PUBLIC_ENV`
- `PUBLIC_API`
- `CLOUDFLARE_TEAM_DOMAIN`
- `CLOUDFLARE_ACCESS_AUDIENCE`
- `GITHUB_CLIENT_ID`
- `TURNSTILE_SITE_KEY`
- `CONTACT_NOTIFICATION_EMAILS`
- `MAILCHANNELS_SENDER_NAME`

### Worker secrets

Set using Wrangler/GitHub secret management, never commit values:

- `MAILCHANNELS_SENDER_EMAIL`
- `GITHUB_CLIENT_SECRET`
- `TURNSTILE_SECRET_KEY`

---

## 4. `gs-api` required bindings

The current `apps/gs-api/wrangler.toml` is authoritative. The list below reflects the production-compatible binding set currently declared there.

### KV

| Binding | Resource / ID | Purpose |
|---|---|---|
| `KV` | `e0b8b807191346c3b0afc25fe716d2cd` | API/platform KV |
| `CONTROL_LOGS` | `a52e94cb331c4e3db08f2aa507e6df09` | Control-plane logs/state |
| `RISK_RADAR_CACHE` | `0b56873b6d7b451f9279481920a15447` | Live Risk Radar cache |
| `TRADING_KV` | `9b3314c3b7af40a284a8c9b6e2990709` | Trading feature flags, OAuth state and orchestration state |

### D1

| Binding | Database | ID | Purpose |
|---|---|---|---|
| `PLATFORM_DB` | `gs_platform_db` | `9703574e-adb7-481e-8d98-96f8ce5f8a90` | Canonical platform DB |
| `AUDIT_DB` | `gs_audit_db` | `1ae71d76-188f-481b-91d9-db2d39013f68` | Audit/compliance data |
| `SIGNALS_DB` | `gs_signals_db` | `76af4653-7f44-417b-b46e-250143d906fd` | Signals data |
| `RISK_RADAR_DB` | `risk-radar-db` | `b0bf3b0e-a7d0-49ae-ac82-4f19450b2ce2` | Live Risk Radar structured storage |
| `JOBS_DB` | `gs_jobs_db` | `750c469c-788d-49e8-9254-77231cffd70f` | Jobs / orchestration DB |
| `PAPER_DB` | `goldshore-paper-trading` | `af94f483-b98b-41c5-aa23-3fbed2764b52` | Paper trading ledger |

**Critical:** `PAPER_DB` is not interchangeable with `PLATFORM_DB`; the fallback in code exists only to prevent a hard crash and does not mean the schemas are equivalent.

### R2

| Binding | Bucket | Purpose |
|---|---|---|
| `GS_ASSETS` | `gs-assets` | Shared platform assets |
| `TELEMETRY` | `gs-telemetry-storage` | Telemetry storage |
| `RISK_RADAR_R2` | current live Risk Radar raw bucket declared in Wrangler | Raw Risk Radar source/object storage |

When docs and Wrangler disagree on a historical `gs-risk-radar-*` resource name, **Wrangler wins** until live Cloudflare state is verified.

### Workers AI

| Binding | Purpose |
|---|---|
| `AI` | Cloudflare Workers AI |

### Queue producers

| Binding | Queue |
|---|---|
| `JOBS_QUEUE` | `goldshore-jobs` |
| `EVENTS_QUEUE` | `gs-events` |
| `MAIL_JOBS_QUEUE` | `gs-mail-jobs` |
| `DEAD_LETTER_QUEUE` | `gs-mail-dead-letter` |

`gs-api` should remain a producer where the current config says producers are owned elsewhere. Do not casually attach additional consumers during deployment cleanup.

### Workflow binding

| Binding | Workflow | Class | Script |
|---|---|---|---|
| `GS_SIGNALS` | `signals-evaluator` | `SignalsEvaluator` | `gs-signals-prod` |

### Scheduled trigger

Production currently declares a daily cron at:

```text
0 2 * * *
```

Purpose documented in Wrangler: OAuth token rotation / refresh work.

### Important vars

- `ENV`
- `CLOUDFLARE_ACCESS_AUDIENCE`
- `CLOUDFLARE_TEAM_DOMAIN`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GITHUB_CLIENT_ID`
- `GITHUB_OAUTH_REDIRECT_URI`
- `TURNSTILE_SITE_KEY`
- `CONTACT_NOTIFICATION_EMAILS`
- `PUBLIC_SITE_URL`
- `MAILCHANNELS_SENDER_NAME`

### Worker secrets

Required or feature-dependent secrets include:

- `JWT_SECRET`
- `ACCESS_CLIENT_SECRET`
- `CONTROL_SYNC_TOKEN`
- `INTEGRATION_MASTER_KEY`
- `MAILCHANNELS_SENDER_EMAIL`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `GITHUB_API_TOKEN` (deployment assistant feature)
- `ANTHROPIC_API_KEY` (deployment assistant ranking feature)
- `GITHUB_CLIENT_SECRET`
- `TURNSTILE_SECRET_KEY`

Secret presence requirements differ by feature and workflow. Treat the current GitHub deployment workflow and runtime code as authoritative before making a secret mandatory.

---

## 5. Subdomain routing rules

Before adding or changing any Gold Shore subdomain:

1. Identify whether the hostname is a **UI route** (`gs-web`) or a **server/API route** (`gs-api`).
2. Search both Wrangler manifests for the hostname.
3. Search Astro `src/pages`, Worker routes, redirects, and host-based dispatch logic.
4. Check Cloudflare DNS/Worker route ownership before deployment.
5. Check Cloudflare Access applications/policies when the hostname is private/admin/MCP/ops.
6. Add the hostname to **only one authoritative Worker route set** unless a deliberate layered routing design is documented.
7. Add or verify all runtime bindings consumed by the code serving that hostname.
8. Update this file and the canonical Wrangler manifest in the same PR.
9. Validate the live hostname after deployment.

Do not solve a routing problem by creating a new Worker unless the two-app architecture is intentionally changed.

---

## 6. Documented but not currently authoritative satellite surfaces

Older infrastructure docs still reference some standalone services and bindings such as:

- `gs-gateway`
- `gs-control`
- `gs-agent`
- standalone `gs-mail`
- standalone `gs-admin`
- `mcp.goldshore.ai`
- legacy service bindings such as `API`, `AGENT`, `SECURITY`, `SIGNALS`, `GS_WEB`, etc.

These entries are **historical/planned context, not permission to recreate the service**.

Current `AGENTS.md` explicitly states that agent, mail, gateway, control-plane, trading, and admin behavior should remain inside `gs-api` / `gs-web` unless a human explicitly changes the architecture contract.

If a legacy Worker still exists in the live Cloudflare account:

- verify whether it receives traffic,
- verify DNS and Worker route ownership,
- verify service-binding callers,
- verify queue consumers and scheduled triggers,
- then retire or retain it deliberately.

Never delete a live legacy resource based only on repository consolidation notes.

---

## 7. Drift / conflict checks currently worth watching

### Risk Radar resource naming

Historical docs name dedicated `gs-risk-radar-*` resources, while the current `gs-api` Wrangler config points at real live Risk Radar resources. Do not "fix" names to match docs unless the intended resources are actually provisioned and data migration is planned.

### `gw.goldshore.ai`

Older docs assign this to a standalone `gs-gateway`; current production Wrangler assigns `gw.goldshore.ai/*` to `gs-api`. Current Wrangler + two-app architecture are authoritative.

### `ops.goldshore.ai`

Older docs assign this to `gs-control`; current production Wrangler assigns it to `gs-api`. Do not recreate `gs-control` without an architecture change.

### `admin.goldshore.ai`

Current route ownership is `gs-web`. Legacy Pages/admin artifacts may still exist in Cloudflare. Verify live routing before deleting legacy resources.

### `mcp.goldshore.ai`

Documented as a desired/private surface in older infrastructure notes but not part of the current authoritative `gs-web` or `gs-api` production route lists shown above. Treat it as **planned/unverified** until code, Wrangler route ownership, Access policy, and live DNS are explicitly established.

---

## 8. New Worker route / binding change checklist

Use this checklist in PRs affecting Cloudflare routing:

- [ ] Hostname and path pattern identified.
- [ ] Existing owner searched in both Wrangler manifests.
- [ ] Existing DNS record / Worker route owner verified in Cloudflare.
- [ ] Cloudflare Access requirements checked.
- [ ] Runtime code path identified.
- [ ] Required KV bindings listed and provisioned.
- [ ] Required D1 bindings listed and migrations applied.
- [ ] Required R2 bindings listed and buckets provisioned.
- [ ] Required Queue producer/consumer role verified.
- [ ] Required Workflow / Durable Object / AI binding verified.
- [ ] Required vars listed without secret values.
- [ ] Required secrets provisioned through GitHub/Cloudflare secret management.
- [ ] Preview route and isolation strategy reviewed.
- [ ] Production route collision check completed.
- [ ] Build/deploy workflow validated.
- [ ] Health/smoke test URL documented.
- [ ] Rollback owner and rollback action documented.
- [ ] `AGENTS.md`, Wrangler config, and this manifest remain consistent.

---

## 9. Quick validation targets

After a production deployment, validate at minimum:

### Web

- `https://goldshore.ai/`
- `https://admin.goldshore.ai/`
- `https://risk.goldshore.ai/`

### API

- `https://api.goldshore.ai/health`
- representative authenticated API route(s) for the changed subsystem

### Route-specific surfaces

When changing `agent`, `mail`, `ops`, `trading`, `dashboard`, `dash`, `gw`, or `*.goldshore.org`, add a smoke test for that hostname to the PR or deployment handoff.

---

## 10. Maintenance rule

Any PR that changes one of the following must update this manifest in the same change:

- a production or preview hostname,
- a Worker route,
- a deploy workflow,
- a KV/D1/R2/Queue/AI/Workflow binding,
- an environment name,
- a required deployment secret,
- Worker ownership of a subdomain,
- the two-app architecture contract.

If this file disagrees with a current `wrangler.toml`, **the Wrangler manifest wins and this file should be corrected**.
