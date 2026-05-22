# Stabilization Sync Check (Recurring)

Frequency: Every 12 hours
Duration: Temporary (until CI baseline stable for 48h)

## 1. Governance Compliance Check

Confirm:
- No direct changes to .github/workflows/
- No modifications to root package.json build keys
- No structural changes to monorepo layout
- No new CI actions introduced

If any violations exist:
- Document in docs/ci/CURRENT_STATE.md
- Do not self-fix
- Escalate via comment only

## 2. Branch Discipline Check

Confirm:
- All new work branches from main
- No stacked PRs on codex/* branches
- No auto-merge enabled on unstable PRs

If divergence detected:
- Report branch name
- Report behind/ahead counts
- Do not create new PR

## 3. CI State Snapshot

Log:
- Failing checks (name + reason)
- YAML syntax errors (duplicate keys, invalid structure)
- Org policy violations (non-org actions, unpinned SHAs)
- Worker build failures

Append summary to:

docs/ci/CURRENT_STATE.md

Do not attempt workflow repair.

## 4. App-Level Repairs Only

If CI failures originate from:
- TypeScript errors
- Missing imports
- Broken module paths
- tsconfig leakage
- KV typing mismatches

You may fix inside:

apps/*

You may not modify:

.github/
infra/
root scripts

## 5. No Expansion Rule

Do not:
- Add features
- Add guard scripts
- Add new checks
- Optimize pipelines

Stabilization only.

## Important: Include a Stop Condition

You do NOT want this running forever.

Add this clause:

If CI is green across all required checks for 48 consecutive hours and no branch divergence >5 commits exists, recommend terminating recurring stabilization sync.
