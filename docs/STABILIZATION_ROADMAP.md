Gold Shore Monorepo Stabilization Roadmap

Status: Active
Mode: Controlled Enforcement
Scope: Structural & CI Stabilization
Philosophy: Stability precedes refactor

⸻

0. Guiding Principles
	1.	Do not refactor architecture during containment.
	2.	Guards must not be weakened to satisfy failing builds.
	3.	Structural drift is fixed — not tolerated.
	4.	Root surface area must shrink over time.
	5.	Merges must become deterministic before innovation resumes.

⸻

1. Wave Overview

Wave	Name	Goal	Status
1	Structural Containment	Stop drift	In Progress
2	Merge Determinism	Stabilize CI & history	Pending
3	Root Surface Freeze	Reduce global mutation	Pending
4	Infra Locality	Remove shared deploy mutation	Pending
5	Dependency Hardening	Reduce cross-app breakage	Pending
6	Drift Monitoring	Detect regression early	Pending
7	Strategic Refactor (Optional)	Long-term evolution	Deferred


⸻

2. Wave 1 — Structural Containment

Objective

Eliminate rename drift, infra duplication, and lockfile churn.

Controls Introduced
	•	Lockfile Guard (.github/workflows/lockfile-guard.yml)
	•	Worker Structure Validator (validate-worker-structure.ts)
	•	Canonical worker folders:
	•	gs-api
	•	gs-control
	•	gs-gateway
	•	gs-agent
	•	gs-mail
	•	Removal of legacy *-worker directories

Requirements
	•	Each canonical worker must contain:
	•	wrangler.toml
	•	Name matching folder
	•	No duplicate worker folders
	•	No lockfile modification outside controlled PR

Exit Criteria
	•	pnpm validate:structure passes
	•	pnpm build passes
	•	CI green
	•	No duplicate root script keys
	•	No orphan worker folders

Explicit Non-Goals
	•	No deploy refactors
	•	No workspace splitting
	•	No infra redesign

⸻

3. Wave 2 — Merge Determinism & CI Discipline

Objective

Eliminate merge unpredictability and CI race conditions.

Controls To Introduce

3.1 Linear History Enforcement
	•	Require linear history
	•	Disable merge commits
	•	Allow squash only
	•	No direct pushes to main

3.2 Document Conflict Neutralization

Add to .gitattributes:

README.md merge=ours
README-v2.md merge=ours
CURRENT_MONOREPO_STATE.md merge=ours
reports/* merge=ours

Generated artifacts must never block merges.

3.3 CI Concurrency Guard

Add to deploy workflows:

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

3.4 Required Status Checks

Main branch must require:
	•	Lockfile guard
	•	Structure validator
	•	Build
	•	Lint
	•	Test


### 3.5 Naming Gate Clarification

- Active file in this repository: `.github/workflows/naming-lint.yml`.
- Planned file name `naming-guard.yml` is **not** present in this repo.
- During stabilization, treat `naming-lint` as the canonical naming gate for branch protection and CI policy.

Temporary disable/archive procedure (only for incident mitigation):

```bash
mkdir -p .github/workflows-backup
mv .github/workflows/naming-lint.yml .github/workflows-backup/
```

Restore with:

```bash
mv .github/workflows-backup/naming-lint.yml .github/workflows/
```

Exit Criteria
	•	5 consecutive merges without conflict
	•	No CI race-condition failures
	•	No docs blocking merges

⸻

4. Wave 3 — Root Surface Freeze

Objective

Minimize global mutation surface.

Target Root package.json State

Allowed scripts:

dev
build
lint
test
validate

Remove:
	•	build:gs-*
	•	deploy:*
	•	app-specific orchestration
	•	ad-hoc scripts

Each app owns its own build/deploy logic.

Additional Controls
	•	Workspace contract validator
	•	Worker name validator
	•	Required files per app:
	•	package.json
	•	wrangler.toml (workers only)
	•	tsconfig.json

Exit Criteria
	•	Root file changes rare
	•	App-level PRs do not modify root
	•	Root script conflicts drop significantly

⸻

5. Wave 4 — Infrastructure Locality

Objective

Remove shared deployment mutation.

Actions
	•	Remove infra/Cloudflare/*
	•	Each worker owns:
	•	Its own wrangler.toml
	•	Its own deploy script
	•	Its own bindings
	•	Split deploy workflows per app
	•	Remove shared deploy matrices touching multiple apps

Exit Criteria
	•	Independent deploy pipelines
	•	No shared infra config
	•	No cross-app deploy breakage

⸻

6. Wave 5 — Dependency & Package Hardening

Objective

Reduce cross-app breakage caused by shared config mutation.

Actions
	•	Convert shared config into pure factories
	•	Eliminate shared mutable config files
	•	Lock dependency versions
	•	Normalize TypeScript configs
	•	Remove implicit cross-imports between apps

Exit Criteria
	•	Updating one worker does not break others
	•	Dependency bumps isolated to single app when possible

⸻

7. Wave 6 — Drift Monitoring

Objective

Make structural regressions visible immediately.

Controls
	•	Nightly structure validation
	•	Worker-name audit job
	•	Workspace contract audit
	•	Environment binding verification
	•	Dependency drift scan

Exit Criteria
	•	Structural drift detected before merge
	•	No silent config regressions

⸻

8. Wave 7 — Strategic Refactor (Optional)

Precondition

Must meet:
	•	30 days of stable merges
	•	No structural regressions
	•	CI deterministic

Potential Actions
	•	Split workers into separate repositories
	•	Introduce versioned internal packages
	•	Modular release tagging
	•	Advanced deployment orchestration

This wave is optional and only considered after prolonged stability.

⸻

9. Enforcement Discipline

The following rule is absolute:

No new architectural refactor until main remains green for 5 consecutive merges.

Stability precedes ambition.

⸻

10. Current Position

Wave 1: In Progress
Blocking items:
	•	Build must pass
	•	Root script duplication must be resolved

No advancement to Wave 2 until Wave 1 exit criteria satisfied.

⸻

11. Change Control Rule

Each wave must be executed in separate PR layers.

Do not:
	•	Combine waves
	•	Bundle structural changes with refactors
	•	Modify CI and architecture in the same PR

Containment first. Evolution second.

⸻

12. Owner

Gold Shore Engineering Control Layer
# Stabilization Roadmap (Wave 1–7)

## 1. Purpose
This document defines the canonical Wave 1–7 stabilization sequence used to harden delivery quality, release confidence, and operational safety.

## 2. Operating Model
Each wave is time-boxed and exits only when all required controls are in place and measurable.

---

## 3. Wave 1 — Baseline Visibility and Safety Rails
### Scope
- Establish baseline build/test signal coverage for all active repositories.
- Define critical-path ownership and escalation paths.
- Capture current policy drift across CI and branch protections.

### Deliverables
- Canonical inventory of required checks per repository.
- Single source of truth for branch protection intent.
- Initial dashboard for pass/fail and flaky-check rates.

### Exit Criteria
- 100% of active repositories mapped to owners and required checks.
- Baseline CI pass rate and flaky rate measured for two consecutive weeks.
- Branch protection policy drift report generated and reviewed.

### Non-Goals
- No blocking policy enforcement yet.
- No large-scale test rewrites.
- No migration of existing pipeline platforms.

### Operational Rule
- Changes improving observability may merge with lightweight review if they do not reduce existing protections.

---

## 4. Wave 2 — Required Check Standardization
### Scope
- Normalize naming and semantics for required checks.
- Remove ambiguous or duplicate status checks.
- Introduce required check classes (build, test, quality, security).

### Deliverables
- Canonical required-check matrix applied to default branches.
- Repository-level mapping from old check names to canonical names.
- Documentation for check ownership and expected runtimes.

### Exit Criteria
- All protected branches reference canonical required check names.
- Duplicate/legacy checks removed from required lists.
- Required checks complete within agreed runtime SLO for 95th percentile.

### Non-Goals
- No strict merge queue rollout yet.
- No mandatory deployment gates for non-production environments.
- No cross-repo monolithic pipeline consolidation.

### Operational Rule
- New required checks must be declared in the CI enforcement matrix before being enabled on protected branches.

---

## 5. Wave 3 — Branch Protection Hardening
### Scope
- Enforce pull-request-based merging on protected branches.
- Require up-to-date branches and linear-history-compatible merge strategy.
- Enforce CODEOWNERS and review minimums.

### Deliverables
- Organization-standard branch protection configuration.
- Exception process with time-bound approvals and audit trail.
- Automated drift detection against protection baseline.

### Exit Criteria
- 100% of protected branches require PRs and required checks.
- Review minimums and CODEOWNERS enforced for all critical paths.
- Drift alerts active and routed to repository owners.

### Non-Goals
- No complete freeze on administrator overrides.
- No elimination of emergency hotfix path.
- No requirement that every repo adopt identical workflow tooling.

### Operational Rule
- Any temporary branch protection exception must include an owner, expiration date, and rollback plan.

---

## 6. Wave 4 — Merge Queue and Concurrency Control
### Scope
- Introduce merge queue for high-churn protected branches.
- Enforce deterministic queue entry criteria and batched validation policy.
- Limit concurrent merges to reduce integration risk.

### Deliverables
- Merge queue policy by repository tier.
- Queue observability: wait time, dequeue reasons, revalidation rate.
- Playbook for queue incidents and queue bypass governance.

### Exit Criteria
- Merge queue enabled on all designated high-churn branches.
- Queue success rate and median wait time meet published targets.
- Untracked direct merges to queued branches reduced to zero.

### Non-Goals
- No queue requirement for low-risk archival repositories.
- No global single queue across unrelated repositories.
- No manual queue management as the default steady-state process.

### Operational Rule
- Queue bypass may be used only for incident response and must trigger post-incident review.

---

## 7. Wave 5 — Quality and Security Gate Tightening
### Scope
- Raise minimum test and quality thresholds for protected merges.
- Enforce security scanning gates at PR time and pre-release time.
- Introduce risk-based differential policies for critical services.

### Deliverables
- Threshold policy for unit/integration coverage deltas.
- Security gate taxonomy (blocker, warn, informational).
- Exception registry for temporary suppressions.

### Exit Criteria
- Quality thresholds enforced on all Tier-1 and Tier-2 repositories.
- Blocker-level security findings prevent merge unless exceptioned.
- Exception registry reviewed on a recurring governance cadence.

### Non-Goals
- No attempt to achieve perfect static-analysis signal quality before enforcement.
- No one-size-fits-all thresholds across all repo types.
- No retroactive blocking on historic findings without triage.

### Operational Rule
- Every active suppression must have a ticket, owner, and expiration date.

---

## 8. Wave 6 — Release Reliability and Operational Readiness
### Scope
- Align CI gates with release readiness controls.
- Enforce release artifact provenance and reproducibility checks.
- Standardize rollback validation for production-impacting systems.

### Deliverables
- Release-readiness checklist integrated into CI/CD workflow.
- Signed artifact and provenance verification policy.
- Rollback drill cadence and evidence capture requirements.

### Exit Criteria
- Production release pipelines enforce provenance verification.
- Rollback procedures tested and documented for all critical services.
- Release-blocking incidents show measurable reduction trend.

### Non-Goals
- No mandatory full blue/green adoption across every service.
- No replacement of all existing release tooling.
- No elimination of controlled manual approvals where required.

### Operational Rule
- A release is not considered eligible until rollback evidence is current and linked.

---

## 9. Wave 7 — Continuous Governance and Auditability
### Scope
- Operationalize long-term governance of checks, protections, and exceptions.
- Implement recurring audits for policy drift and control efficacy.
- Tie stabilization outcomes to service-level reliability metrics.

### Deliverables
- Governance calendar with quarterly audit checkpoints.
- KPI set for policy compliance, exception burn-down, and stability outcomes.
- Executive-ready scorecard for ongoing enforcement health.

### Exit Criteria
- Quarterly audits executed with tracked remediation closure.
- Policy compliance sustained above target threshold across protected repos.
- Exception volume and aging trend downward over two consecutive quarters.

### Non-Goals
- No governance process that blocks urgent production safety work.
- No purely manual audit workflow without automation support.
- No static policy set that cannot evolve with platform needs.

### Operational Rule
- Governance changes must be versioned, announced, and accompanied by an effective date.

---

## 10. Dependency Order
1. Wave 1 must complete before enforcing Wave 2 controls.
2. Wave 2 and Wave 3 must complete before broad Wave 4 rollout.
3. Wave 5–7 depend on stable Wave 4 queue behavior and measurable signal quality.

## 11. Success Measures
- Lower change-failure rate on protected branches.
- Reduced mean time to detect and prevent unsafe merges.
- Sustained decrease in policy drift and exception aging.
