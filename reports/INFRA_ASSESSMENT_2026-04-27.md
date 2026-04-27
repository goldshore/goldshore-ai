# GoldShore Infrastructure Assessment
**Date:** 2026-04-27  
**Scope:** `marzton/goldshore-ai` vs `marzton/goldshore-web` vs `marzton/goldshore-gateway`  
**Criteria:** Build/deploy setup · Project structure · Dependency hygiene · Configuration clarity · Maintenance readiness

---

## Verdict

**`marzton/goldshore-ai` is the strongest candidate by a wide margin.**

It is the only repository with a coherent, production-ready monorepo foundation. The other two repos are better understood as earlier experiments or component scaffolds, not viable bases for ongoing platform development.

---

## Comparison Matrix

| Dimension | goldshore-ai | goldshore-web | goldshore-gateway |
|---|---|---|---|
| **Package manager** | pnpm 9 + lockfile guard | npm (package-lock.json) | npm (package-lock.json) |
| **Build orchestration** | TurboRepo (task graph, caching) | None | None |
| **Monorepo structure** | 7 app workspaces + 11 packages | Flat (build script: `echo done`) | Flat (multi-scaffold dirs at root) |
| **CI/CD** | 20+ workflows (per-service deploy, preview, lockfile guard, hygiene) | 4 workflows (basic) | 9 workflows (partial coverage) |
| **Deploy artifacts** | Cloudflare Pages + Workers via wrangler (per-env) | Unknown (committed `dist/`) | Partial (worker + pages) |
| **Infra config** | `infra/Cloudflare/` per-service `.wrangler.toml` + `desired-state.yaml` | Stubs only | Single `wrangler.jsonc` |
| **Dependency protocol** | `workspace:^` enforced by lint + CI | N/A | N/A |
| **Branch/lockfile protection** | Lockfile guard, required merge checks, CODEOWNERS | Dependabot only | Merge gate only |
| **Design system** | `packages/theme` (tokens, theme manager) | None | None |
| **Schema layer** | `packages/core-schema`, `schemas/d1/` | None | None |
| **Auth package** | `packages/auth` (verify.ts, middleware) | None | None |
| **Documentation** | Runbooks, audit trail, policies, ecosystem doc | README only | RUNBOOK.md, AGENT_SCOPE.yaml |
| **Structural validation** | `pnpm validate` (naming, workspace contract, worker structure) | None | None |
| **Audit/drift tracking** | AUDIT_EXECUTIVE_SUMMARY.md (live vs canonical) | None | None |

---

## goldshore-ai — Detail

### What it gets right
- **Coherent monorepo:** All seven platform services (`gs-web`, `gs-api`, `gs-admin`, `gs-control`, `gs-gateway`, `gs-agent`, `gs-mail`) plus eleven shared packages co-exist under one TurboRepo workspace. Changes cascade correctly through the dependency graph.
- **CI discipline:** Separate deploy workflows per service with pinned action SHAs on production-critical steps. Lockfile changes are blocked in PRs, preventing accidental dependency drift.
- **Infra-as-code:** Every Cloudflare Worker and Pages deployment has a corresponding `wrangler.toml` in `infra/Cloudflare/`, with `desired-state.yaml` for drift comparison. A machine-readable canonical state JSON (`infra/AGENT_CANONICAL_STATE.json`) and automated audit scripts round out the picture.
- **Developer tooling:** `pnpm validate` enforces workspace protocol, canonical structure, and worker naming before any merge. `pnpm repo:health` gives a quick at-a-glance state check.
- **Shared packages:** `packages/theme`, `packages/auth`, `packages/core-schema`, and `packages/ui` prevent duplication across services.

### Known gaps (already tracked)
- Three workers not yet deployed (`gs-control`, `gs-mail`, `gs-agent`).
- D1 migrations defined but not applied against live databases.
- JWT auth middleware fails open — a security issue documented in `AUDIT_EXECUTIVE_SUMMARY.md`.
- Worker naming mismatch: live CF has `gs-platform` where repo says `gs-gateway`.
- `actions/checkout@v6.0.2` is pinned in `ci.yml` and `lockfile-guard.yml`; that tag is non-standard (latest is v4) and may fail on new runners.

These are known and tracked — importantly, they are operational gaps, not structural ones.

---

## goldshore-web — Detail

The root `package.json` build script is `"build": "echo done"`. There are committed build artifacts (`dist/`). The repo appears to be an earlier monolith attempt or a partial migration staging area. Several subdirectories (`goldshore-admin-scaffold/`, `goldshore-api-scaffold/`, `goldshore-gateway/`) suggest content was later migrated into `goldshore-ai`. Not suitable as a primary development base.

---

## goldshore-gateway — Detail

A React Router + Hono fullstack app that conflates admin dashboard code with gateway worker scaffolds. The root `package.json` is named `goldshore-admin`, the repo is named `goldshore-gateway`, and a 475 KB auto-generated `worker-configuration.d.ts` is committed to source control. Multiple scaffold directories (`goldshore-api/`, `goldshore-control-worker/`, `goldshore-gateway/`, `app/`) sit at the repo root with no workspace tooling to unify them. CI/CD is partial. Not suitable as a primary development base.

---

## Recommendation

**Use `marzton/goldshore-ai` as the single source of truth for all ongoing development and deployment.**

The operational gaps are well-documented and addressable in order (see `AUDIT_EXECUTIVE_SUMMARY.md` and `docs/DEPLOYMENT_RUNBOOK.md`). The structural foundation — TurboRepo workspace, per-service CI/CD, infra-as-code, shared packages, and validation tooling — is the hardest part to build and it is already in place here.

The `goldshore-web` and `goldshore-gateway` repos should be treated as archived scaffolding. Any live code in those repos that is not yet migrated (e.g., the React Router admin dashboard in `goldshore-gateway`) should be evaluated for absorption into `apps/gs-admin` or the appropriate `goldshore-ai` workspace.
