Main Branch Rules

Enable:
	•	Require pull request before merging
	•	Require status checks to pass
	•	Require branches up to date before merging
	•	Require linear history
	•	Require signed commits (optional but recommended)
	•	Include administrators

Disable:
	•	Allow merge commits
	•	Allow rebase merges (optional, but squash-only preferred)
	•	Direct pushes to main

⸻

Required Status Checks

Select:
	•	lockfile-guard
	•	validate:structure
	•	build
	•	lint
	•	test
	•	naming-lint (active naming gate; equivalent policy role of planned naming-guard)

Deploy checks optional depending on environment.

⸻

Repository Settings

Enable:
	•	Branch protection on main
	•	Automatic PR branch deletion after merge
	•	Dependency vulnerability alerts
	•	Secret scanning

⸻

Pull Request Rules

Require:
	•	At least 1 approval
	•	No self-approval
	•	No force-push after approval without re-review
# GitHub Branch Protection Checklist

## 1. Purpose
This checklist defines the canonical branch protection baseline for stabilization enforcement.

## 2. Repository Scope
Apply this checklist to all default branches and any release branches designated as protected.

## 3. Required Baseline Settings
- Require a pull request before merging.
- Require approvals (minimum set by repository tier).
- Dismiss stale pull request approvals when new commits are pushed.
- Require review from Code Owners where CODEOWNERS applies.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Restrict who can push to matching branches.
- Disallow force pushes.
- Disallow branch deletions.

## 4. Recommended Hardened Settings
- Require conversation resolution before merging.
- Require linear history where compatible with team workflow.
- Enforce signed commits where organizational policy requires it.
- Enable merge queue for high-churn protected branches.
- Lock branch for archival or release-finalized lines.

## 5. Rulesets and Pattern Hygiene
- Prefer organization rulesets for consistency across repositories.
- Use explicit branch patterns and avoid overly broad wildcards.
- Separate default-branch and release-branch protections when requirements differ.

### Exit Criteria
- Ruleset coverage includes all protected branch patterns.
- No conflicting rules produce ambiguous enforcement behavior.
- Drift between intended baseline and applied rules is detectable.

### Non-Goals
- No assumption that one rule fits every repository risk profile.
- No reliance on manual spot checks as the only drift control.
- No permanent admin bypass configuration.

### Operational Rule
- Changes to branch protection must be reviewed by repository owners and recorded in governance history.

## 6. Pull Request Requirements by Tier

| Repository Tier | Minimum Approvals | Code Owner Review | Additional Requirement |
|---|---:|---|---|
| Tier 1 (critical) | 2 | Required | Merge queue strongly recommended |
| Tier 2 (important) | 1–2 | Required on critical paths | Required checks at L2+ |
| Tier 3 (standard) | 1 | Recommended | Required checks at L2 |

## 7. Administrator and Emergency Controls
- Minimize administrator bypass usage.
- Define emergency merge policy with incident ticket linkage.
- Require post-incident audit for every emergency bypass.

### Exit Criteria
- Emergency bypass events are logged and reviewed within the defined SLA.
- Repeated bypass causes are tracked to remediation.

### Non-Goals
- No elimination of emergency response capability.
- No untracked administrative override activity.

### Operational Rule
- Every emergency bypass must reference an incident and include follow-up action items.

## 8. Drift Detection Checklist
- Export current branch protection/ruleset configuration.
- Compare against canonical baseline and tier policy.
- Open remediation issues for any missing or weaker controls.
- Re-validate after remediation completion.

## 9. Audit Cadence
- Weekly automated drift scan for protected branches.
- Monthly owner attestation for Tier-1 repositories.
- Quarterly governance review of exceptions and policy changes.


## 10. Goldshore `main` branch implementation

- Enforced via `.github/workflows/enforce-branch-protection.yml` + `scripts/configure-branch-protection.mjs`.
- Required status checks:
  - `Required Merge Checks / workspace-install`
  - `Required Merge Checks / gs-api-build-test`
  - `Required Merge Checks / gs-web-build`
  - `Required Merge Checks / gs-admin-build`
  - `Required Merge Checks / deployment-dry-run`
- `strict: true` is enabled so the PR branch must be up to date with the base branch before merge.
