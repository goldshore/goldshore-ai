# Routing Source of Truth: Pages ↔ Workers

This runbook defines the **single workflow** every agent must use when adding or changing URL routing across Cloudflare Pages and Workers.

## 1) Canonical Ownership Model

For each hostname/path pattern, there is exactly one router of record:

- **Pages-owned hostnames** are attached as Pages custom domains.
- **Workers-owned hostnames** are attached as Worker routes.
- Never bind the same hostname+path to both a Pages project and a Worker route.

Authoritative policy and maps:

- Route ownership policy: `policy/ROUTE_POLICY.md`
- Platform binding inventory: `infra/Cloudflare/BINDINGS_MAP.md`
- Canonical Wrangler manifest selection: `infra/Cloudflare/README.md`
- Desired infra state contract: `infra/Cloudflare/desired-state.yaml`

## 2) Binding Rules (What goes where)

### Pages domains

Use Pages project custom domain settings for:

- `goldshore.ai`, `www.goldshore.ai`, `preview.goldshore.ai` → `gs-web`
- `admin.goldshore.ai`, `admin-preview.goldshore.ai` → `gs-admin`

Do not create Worker routes for these hosts unless policy is explicitly changed in `policy/ROUTE_POLICY.md`.

### Worker routes

Use Worker route patterns for service subdomains:

- `api.goldshore.ai/*` (+ preview) → `gs-api`
- `gw.goldshore.ai/*` (+ preview) → `gs-gateway`
- `agent.goldshore.ai/*` → gateway entry for agent traffic
- `ops.goldshore.ai/*` → `gs-control`

## 3) Required Change Procedure

When changing URL routing or service bindings, all agents follow this sequence:

1. **Edit policy first** in `policy/ROUTE_POLICY.md` if ownership changes.
2. **Edit manifests/config** in canonical wrangler files only (see `infra/Cloudflare/README.md`).
3. **Sync desired state** in `infra/Cloudflare/desired-state.yaml` when infra intent changes.
4. **Validate collisions**:
   - `node scripts/check-route-collisions.mjs`
5. **Run infra checks** (when touching infra):
   - `pnpm -C infra/Cloudflare test`
6. **Deploy with canonical token**:
   - all worker/API services must use `CLOUDFLARE_BUILD_API_TOKEN` from `gs-control` ownership.

## 4) PR Checklist for Routing Changes

Copy this into PRs that touch routing:

- [ ] Updated `policy/ROUTE_POLICY.md` (if ownership changed)
- [ ] Updated canonical wrangler/config only (no legacy manifest edits)
- [ ] Updated `infra/Cloudflare/desired-state.yaml` if route/binding intent changed
- [ ] Passed `node scripts/check-route-collisions.mjs`
- [ ] Passed Cloudflare infra tests
- [ ] Confirmed deploy token source is `gs-control`

## 5) Fast Decision Matrix

- “I need a new website page on existing web host.”
  - Add page/app code only; no Worker route.
- “I need a new service endpoint under `api.*`.”
  - Implement in `gs-api`; keep same route family.
- “I need a new operational/admin machine endpoint.”
  - Put under `ops.*` via `gs-control`.
- “I need a brand-new subdomain service.”
  - Propose ownership update in `policy/ROUTE_POLICY.md` first, then manifests + desired-state.

## 6) Anti-Patterns (Block these in review)

- Adding both Pages custom domain and Worker route to same hostname/path.
- Editing legacy manifests under `infra/Cloudflare/legacy/` for deploy behavior.
- Introducing alternate/fallback deploy secrets for workers.
- Skipping route collision validation.

