# Repository Ownership & Service Registry

**Source of truth for:** App locations, build paths, deployment targets, domain ownership
**Authority:** Marzton (account owner); gs-control (CI/CD authority for worker deployments)
**Last updated:** 2026-04-24
**Review cycle:** Quarterly or when new apps are added

---

## Canonical Repository Structure

### Primary Monorepo: `marzton/goldshore-ai`

All GoldShore Labs infrastructure, workers, and shared services live here.

```
marzton/goldshore-ai/
├── apps/
│   ├── gs-web/                    (Astro Pages; domains: goldshore.ai, www.goldshore.ai)
│   ├── gs-admin/                  (Admin cockpit; domain: admin.goldshore.ai)
│   ├── gs-api/                    (API worker; route: api.goldshore.ai/*)
│   ├── gs-gateway/                (Gateway router; deployed as gs-platform; route: gw.goldshore.ai/*)
│   ├── gs-control/                (Ops/control plane; route: ops.goldshore.ai/*)
│   ├── gs-mail/                   (Email/Queue service; backend only)
│   ├── gs-agent/                  (Agent runtime; route: agent.goldshore.ai/* via gateway)
│   ├── goldshore-org/             (Org router worker; domains: goldshore.org, www.goldshore.org)
│   └── banproof-me/               (PoA worker; domain: banproof.me)
├── packages/
│   ├── auth/                      (JWT verification library)
│   ├── theme/                     (Design system)
│   ├── config/                    (Shared config)
│   ├── ui/                        (UI components)
│   └── utils/                     (Utilities)
├── schemas/
│   ├── d1/                        (D1 database migrations)
│   └── r2/                        (R2 bucket configs)
├── infra/
│   └── Cloudflare/                (Canonical wrangler manifests)
├── .github/workflows/             (CI/CD)
├── docs/                          (Architecture, ops guides, policies)
└── scripts/                       (Build, audit, validation scripts)
```

---

## Service Registry

### Web Tier (Cloudflare Pages)

| Service | Package | Root Path | Build Output | Domains | Zone | Env Vars |
|---|---|---|---|---|---|---|
| **gs-web** | `@goldshore/gs-web` | `apps/gs-web` | `dist/` | `goldshore.ai`<br>`www.goldshore.ai`<br>`preview.goldshore.ai` | `goldshore.ai` | `PUBLIC_API=https://api.goldshore.ai`<br>`PUBLIC_GATEWAY=https://gw.goldshore.ai` |
| **gs-admin** | `@goldshore/gs-admin` | `apps/gs-admin` | `dist/` | `admin.goldshore.ai`<br>`admin-preview.goldshore.ai` | `goldshore.ai` | Same as gs-web<br>`+CLOUDFLARE_ACCESS_AUDIENCE` |

### Edge Workers

| Worker | Package | Root Path | Entry Point | Routes | Zone | Bindings |
|---|---|---|---|---|---|---|
| **gs-api** | `@goldshore/gs-api` | `apps/gs-api` | `src/index.ts` (Hono) | `api.goldshore.ai/*`<br>`api-preview.goldshore.ai/*` | `goldshore.ai` | KV: `gs_api_kv_001`<br>D1: `goldshore`<br>R2: `gs-assets`<br>AI: `goldshore-ai-gateway` |
| **gs-platform** | `@goldshore/gs-gateway` | `apps/gs-gateway` | `src/index.ts` (Hono) | `gw.goldshore.ai/*`<br>`agent.goldshore.ai/*` | `goldshore.ai` | KV: `gs-ai-cache`<br>Service: `gs-api`<br>Service: `gs-agent` |
| **gs-control** | `@goldshore/gs-control` | `apps/gs-control` | `src/index.ts` | `ops.goldshore.ai/*` | `goldshore.ai` | Env: `CLOUDFLARE_API_TOKEN`<br>Env: `CLOUDFLARE_ACCOUNT_ID` |
| **gs-mail** | `@goldshore/gs-mail` | `apps/gs-mail` | `src/index.ts` | (Backend/Queue only) | — | Queue: `goldshore-jobs` (consumer) |
| **gs-agent** | `@goldshore/gs-agent` | `apps/gs-agent` | `src/index.ts` (Hono) | (Via gateway) | `goldshore.ai` | KV: `gs-telemetry`<br>Queue: `goldshore-jobs` (producer) |
| **goldshore-org** | `@goldshore/goldshore-org` | `apps/goldshore-org` | `src/router.ts` | `goldshore.org/*`<br>`www.goldshore.org/*` | `goldshore.org` | Service: `gs-api`<br>Env: `ASSETS_ORIGIN` |
| **banproof-me** | `@goldshore/banproof-me` | `apps/banproof-me` | `src/index.ts` | `banproof.me/*`<br>`www.banproof.me/*` | `banproof.me` | D1: `banproof_platform`<br>R2: `gs-assets`<br>Workflows: `ContentProcessingWorkflow` |

---

## Deployment Authority

### Workers (`CLOUDFLARE_BUILD_API_TOKEN`)

**Authority:** `gs-control` service
**Owned by:** Platform ops
**Scope:** Deploy any worker on the account (gs-api, gs-platform, gs-control, gs-mail, gs-agent, goldshore-org, banproof-me)

**CI/CD:** All worker deployments must:
1. Use `CLOUDFLARE_BUILD_API_TOKEN` exclusively (no fallback expressions)
2. Target the canonical wrangler manifest path (from this table)
3. Pass pre-deploy validation (scripts/validate-worker-names.ts)

### Pages Projects (GitHub Actions)

**Authority:** Individual repo maintainers (gs-web, gs-admin repos if separate)
**Scope:** Deploy frontend builds to Cloudflare Pages

**If separate repos:**
- `marzton/goldshore-web` → gs-web Pages project
- `marzton/goldshore-admin` → gs-admin Pages project

**If in monorepo:** GitHub Actions in `marzton/goldshore-ai` triggers Pages deployment on commit to main.

---

## Domain Ownership Rules

### Primary Rules

1. **One domain, one owner.** No service can claim routes on two domains without explicit permission from the owner.
   - Exception: `goldshore.ai` is shared between gs-web (Pages) and workers (api.*, gw.*, ops.*, agent.*)
   - These are subdomains — no conflict.

2. **Zone authority.** Each Cloudflare zone has one owner:
   - `goldshore.ai` → GoldShore Labs (Marzton)
   - `goldshore.org` → GoldShore Labs (Marzton)
   - `banproof.me` → BanProof (Marzton)

3. **Custom domain vs. route distinction:**
   - **Custom domain (Pages):** Cloudflare automatically routes apex/www to Pages project
     Example: `goldshore.ai` → `gs-web.pages.dev`
   - **Routes (Workers):** Explicit route patterns registered with worker
     Example: `api.goldshore.ai/*` → `gs-api` worker

4. **No route conflicts.** If two workers claim the same route pattern, the first deployed wins (and breaks the second).

### Subdomain Allocation Table

| Subdomain | Owner | Service | Type | Conflict Risk |
|---|---|---|---|---|
| @ (apex) | GoldShore Labs | gs-web Pages | Custom domain | If both gs-web Pages and a worker claim apex |
| www | GoldShore Labs | gs-web Pages | Custom domain | No (CNAME to apex) |
| api | GoldShore Labs | gs-api | Route | No |
| gw | GoldShore Labs | gs-platform | Route | No |
| ops | GoldShore Labs | gs-control | Route | No |
| agent | GoldShore Labs | gs-agent | Route | No |
| admin | GoldShore Labs | gs-admin Pages | Custom domain | No |
| admin-preview | GoldShore Labs | gs-admin Pages | Custom domain | No |
| preview | GoldShore Labs | gs-web Pages | Custom domain | No |

---

## Dependency Graph

```
gs-web (Astro Pages, goldshore.ai)
└── @goldshore/theme
└── @goldshore/config
└── @goldshore/ui
└── @goldshore/auth

gs-admin (Astro Pages, admin.goldshore.ai)
└── @goldshore/theme
└── @goldshore/config
└── @goldshore/auth

gs-api (Worker)
└── @goldshore/auth
└── @goldshore/config

gs-platform (Worker, named gs-gateway in repo)
├── @goldshore/auth
├── Service binding: gs-api (prod)
└── Service binding: gs-agent (prod)

gs-control (Worker)
└── Secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID

gs-mail (Worker)
└── Queue consumer: goldshore-jobs

gs-agent (Worker)
├── @goldshore/auth
└── Queue producer: goldshore-jobs

goldshore-org (Worker)
├── Service binding: gs-api (prod)
└── R2: gs-assets

banproof-me (Worker)
├── Workflows: ContentProcessingWorkflow
├── D1: banproof_platform
├── R2: gs-assets
└── External: OpenAI API
```

---

## Prohibited Patterns

### ❌ DO NOT

1. **Deploy a worker without checking wrangler.toml is in the canonical path**
   ✅ Correct: `infra/Cloudflare/gs-api.wrangler.toml`
   ❌ Wrong: `apps/gs-api/wrangler.toml` (may be stale)

2. **Use fallback expressions for `CLOUDFLARE_BUILD_API_TOKEN`**
   ✅ Correct: `${{ secrets.CLOUDFLARE_BUILD_API_TOKEN }}`
   ❌ Wrong: `${{ secrets.CLOUDFLARE_BUILD_API_TOKEN || secrets.CLOUDFLARE_API_TOKEN }}`

3. **Deploy a Pages project with the same name as a worker**
   ✅ Correct: Worker `gs-api`, Pages project `gs-web`
   ❌ Wrong: Worker `gs-api`, Pages project `gs-api`

4. **Add a service to the monorepo without updating this registry**
   ✅ Correct: Add to monorepo, update REPO_OWNERSHIP.md, commit together
   ❌ Wrong: Add service, deploy, leave docs out of sync

5. **Deploy from a local machine or branch without an audit trail**
   ✅ Correct: All deployments go through `marzton/goldshore-ai` main branch + GitHub Actions
   ❌ Wrong: `wrangler deploy` from laptop (like current banproof-me)

---

## Adding a New Service

When adding a new worker, Pages project, or package:

1. **Create the app directory** in appropriate tier (`apps/` or `packages/`)
2. **Create wrangler.toml** if worker; include canonical name and routes
3. **Add to package.json workspace**
4. **Update this file** (REPO_OWNERSHIP.md) with new entry
5. **Update docs/architecture/** with dependency diagram
6. **Add GitHub Actions workflow** to deploy on push to main
7. **Commit all together** — never add a service without docs

---

## Service Naming Convention

### Workers
- Prefix: `gs-` (GoldShore Service)
- Format: `gs-{service-name}`
- Examples: `gs-api`, `gs-gateway`, `gs-control`, `gs-mail`
- Exception: `banproof-me` (separate brand)

### Packages
- Prefix: `@goldshore/`
- Format: `@goldshore/{package-name}`
- Examples: `@goldshore/auth`, `@goldshore/theme`, `@goldshore/config`

### Environment Names
- Allowed: `prod`, `production`, `preview`, `dev`, `staging`
- Canonical across monorepo: `prod` (for workers), `production` (for Pages)
- Never: `prod1`, `prod-2`, `latest`, `main` (these go in branches, not env names)

---

## Review & Audit

**Monthly check:**
```bash
pnpm validate  # Runs all validation scripts
git diff docs/ownership-matrix.md  # Changes since last review
```

**Quarterly review:** Confirm all services are live and healthchecking.

**On each deployment:** Diff this file to ensure no untracked changes.
