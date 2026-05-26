# Cloudflare D1 Gap Audit

## Scope and evidence map
This audit is non-destructive and documents configuration/state gaps only. Evidence is cross-linked to repository paths in `apps/`, `infra/Cloudflare/`, `.github/workflows/`, and `schemas/`.

Primary evidence:
- App worker configs: `apps/*/wrangler.toml`
- Infra worker configs and legacy references: `infra/Cloudflare/*.wrangler.toml`, `infra/Cloudflare/legacy/*.wrangler.toml`
- CI/CD controls: `.github/workflows/cloudflare-infra-guard.yml`, `.github/workflows/infrastructure-guard.yml`, `.github/workflows/deploy-platform.yml`
- Database schema/migration files: `schemas/d1/*.sql`, `apps/gs-web/src/db/*.sql`, `apps/gs-api/db/*.sql`

---

## 1) Wrangler classification (active / reference / legacy / duplicate / obsolete)

### Active (deployed path appears in workflows)
- `apps/gs-platform/wrangler.toml` (explicit deploy in workflow).
- `apps/gs-api/wrangler.toml` (explicit deploy in workflow).
- `apps/gs-control/wrangler.toml` (explicit deploy in workflow).
- `apps/gs-agent/wrangler.toml` (explicit deploy in workflow).
- `apps/gs-mail/wrangler.toml` (explicit deploy in workflow).
- `apps/gs-admin/wrangler.toml` and `apps/banproof-me/wrangler.toml` (deployed via dedicated workflows or app-specific deploy jobs).

### Reference (infra mirror/source-of-truth candidates)
- `infra/Cloudflare/gs-platform.wrangler.toml`
- `infra/Cloudflare/gs-api.wrangler.toml`
- `infra/Cloudflare/gs-agent.wrangler.toml`
- `infra/Cloudflare/gs-admin.wrangler.toml`
- `infra/Cloudflare/gs-web.wrangler.toml`

These appear to serve governance/audit/reference roles alongside app-local configs.

### Legacy
- `infra/Cloudflare/legacy/goldshore-api.wrangler.toml`
- `infra/Cloudflare/legacy/goldshore-web.wrangler.toml`
- `infra/Cloudflare/legacy/goldshore-admin.wrangler.toml`
- `infra/Cloudflare/legacy/README.md`

Legacy files contain historical aliases and commented binding examples rather than active deployment definitions.

### Duplicate / drift-risk
- `apps/gs-platform/wrangler.toml` and `infra/Cloudflare/gs-platform.wrangler.toml` both define similar routing and binding blocks.
- App-level and infra-level pairs for `gs-api`, `gs-agent`, and `gs-admin` create potential drift when one file updates first.

### Potentially obsolete patterns
- Dual env naming (`prod` and `production`) appears in some worker configs (notably `gs-api` and `gs-agent`), which may be intentional for backward compatibility but is a maintenance risk.

---

## 2) Missing D1 / KV / R2 / Queue / service bindings (gap-focused)

### D1
- `apps/gs-api/wrangler.toml` binds `DB` to `goldshore`, while `apps/gs-admin/wrangler.toml` preview binds `DB` to `goldshore_preview`; schema parity validation is not codified in workflow checks.
- `apps/gs-core-worker/wrangler.toml` uses `GS_SIGNALS_DB` -> `gs_signals_db`; corresponding migration files are not present under `schemas/d1/`.
- `apps/armsway-com/wrangler.toml` binds `GS_AUDIT_DB` -> `gs_audit_db`; corresponding migration files are not present under `schemas/d1/`.

### KV
- `apps/gs-api/wrangler.toml` uses `KV` and `CONTROL_LOGS`, but no central contract file maps all KV bindings across all workers for consistency checks.

### R2
- Bucket naming differs (`gs-platform-assets`, `gs-assets`, `gs-assets-preview`, `gs-telemetry-storage`) and no single schema/contract exists under `schemas/` to assert expected bucket-to-binding mapping.

### Queues
- Queue consumers exist in `apps/gs-agent/wrangler.toml` and `apps/gs-mail/wrangler.toml`; producer/consumer contract checks across workers are not explicit in CI.

### Services
- `apps/gs-admin/wrangler.toml` defines `API_SERVICE` -> `gs-api`; `apps/gs-platform/wrangler.toml` defines multi-service hub bindings. There is no CI assertion that target service names match currently deployed worker names in all environments.

---

## 3) Missing Env typings
- A dedicated typings file exists at `apps/gs-api/worker-configuration.d.ts`, but equivalent typed env contracts are not consistently visible for other workers with substantial bindings (`gs-platform`, `gs-admin`, `gs-mail`, `armsway-com`, `gs-core-worker`).
- Risk: runtime-only detection of binding name mismatches (e.g., typo in `binding` key versus code usage).

---

## 4) Missing migrations / schema coverage
- `schemas/d1/001_platform.sql` and `schemas/d1/002_audit.sql` exist, but D1 database names in wrangler configs include at least `goldshore`, `goldshore_preview`, `gs_platform_db`, `gs_signals_db`, `gs_audit_db`; one-to-one mapping from database name to migration folder/file set is not explicit.
- SQL artifacts also exist outside canonical `schemas/d1/` (e.g., `apps/gs-web/src/db/*.sql`, `apps/gs-api/db/*.sql`), increasing ambiguity about migration source of truth.

---

## 5) Workflow gaps
- Deploy workflows run `wrangler deploy`, but there is no mandatory pre-step to verify every bound D1 database has an expected migration state marker.
- Guard workflows validate route and some infra constraints, but do not appear to enforce queue producer/consumer completeness or service binding target existence end-to-end.
- Build token policy note exists in wrangler comments for `gs-platform`, but workflow-level assertion that all worker builds use the `gs-control` token should remain explicit and centrally enforced.

---

## 6) Route / app-name conflicts
- `apps/gs-platform/wrangler.toml` includes broad routes for `goldshore.ai/*`, `www.goldshore.ai/*`, `admin.goldshore.ai/*`, and armsway domains.
- `apps/armsway-com/wrangler.toml` also routes `armsway.com/*` and `www.armsway.com/*`.
- Potential conflict risk exists where multiple workers claim overlapping host/path patterns unless controlled by environment-specific activation and guard checks.
- `apps/gs-api/wrangler.toml` uses empty route arrays, while `gs-admin` and `gs-platform` rely on service/boundary behavior; this can be safe but should be documented as intentional architecture.

---

## 7) Secret-risk findings (non-secret, process only)
- Several workflows rely on `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_BUILD_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`; failures are detected in some guard jobs, but secret scope/rotation policy is not documented in this audit scope.
- Mixed env naming (`prod` vs `production`) can cause accidental secret mis-binding in dashboard-managed environments.
- Legacy wrangler files with commented examples may mislead contributors into adding secrets or bindings in non-canonical files.

---

## 8) Safe integration checklist (non-destructive sequencing)
1. **Inventory only:** generate machine-readable inventory of all bindings/routes per wrangler file (no deploy, no edits to routes).
2. **Classify canonical sources:** mark each worker config as canonical app config vs infra reference; document ownership.
3. **Normalize env contract docs:** publish env-name matrix (`dev`/`preview`/`prod`/`production`) and intended compatibility behavior.
4. **Type coverage pass:** add/align `Env` typings for each binding-heavy worker before any runtime changes.
5. **Schema mapping pass:** map each D1 database name to authoritative migration path under `schemas/d1/` without changing live DBs.
6. **CI policy expansion:** add non-destructive checks for queue producer/consumer parity and service target existence.
7. **Conflict simulation:** run route overlap detection in CI using declared patterns only (no dashboard mutations).
8. **Legacy quarantine:** keep legacy files read-only and annotate as non-deployable references.
9. **Change window gate:** only after all checks pass, plan operational changes in separate controlled PRs.

This checklist intentionally excludes route changes, secret exposure, and file deletion directives.

---

## Evidence index by required directories
- `apps/`: `apps/gs-api/wrangler.toml`, `apps/gs-admin/wrangler.toml`, `apps/gs-platform/wrangler.toml`, `apps/gs-agent/wrangler.toml`, `apps/gs-mail/wrangler.toml`, `apps/armsway-com/wrangler.toml`, `apps/gs-core-worker/wrangler.toml`, `apps/gs-api/worker-configuration.d.ts`, `apps/gs-web/src/db/*.sql`, `apps/gs-api/db/*.sql`
- `infra/Cloudflare/`: `infra/Cloudflare/gs-*.wrangler.toml`, `infra/Cloudflare/legacy/*.wrangler.toml`, `infra/Cloudflare/BINDINGS_MAP.md`, `infra/Cloudflare/config.yaml`, `infra/Cloudflare/desired-state.yaml`
- `.github/workflows/`: `deploy-platform.yml`, `deploy-gs-admin.yml`, `deploy-banproof-me.yml`, `cloudflare-infra-guard.yml`, `infrastructure-guard.yml`
- `schemas/`: `schemas/d1/001_platform.sql`, `schemas/d1/002_audit.sql`, `schemas/r2/R2_BINDING_CONFIG.sql`
