# Workflow Inventory

Last audited: 2026-08-12

The repository is a two-app monorepo. `gs-web` owns every UI route and
`gs-api` owns every backend, scheduled, queue, email, and workflow handler.
Only `deploy-gs-web.yml` and `deploy-gs-api.yml` are production deploy files.

| Workflow | Purpose | Trigger | Merge blocking |
| --- | --- | --- | --- |
| `admin-merge-cockpit.yml` | Create a reviewed, SHA-locked salvage PR | Manual | No |
| `audit-gs-api-secrets.yml` | Audit secret names against the gs-api contract | Schedule/manual | No |
| `ci.yml` | Workspace validation and builds | Push/PR | Yes when required |
| `cloudflare-audit.yml` | Read-only Cloudflare inventory | Manual | No |
| `cloudflare-operator.yml` | Record an approved dashboard-only account change | Manual | No |
| `deploy-gs-api.yml` | Migrate and deploy the unified API Worker | Main/stage push/manual | No |
| `deploy-gs-web.yml` | Build the canonical web Worker for Workers Builds | Main/stage push/PR/manual | No |
| `enforce-branch-protection.yml` | Reconcile GitHub main-branch protection | Main policy-file push/manual | No |
| `issue-agent-triage.yml` | Mirror issue handoff tags to labels | Issue events/comments | No |
| `label.yml` | Apply path labels to PRs | PR target | No |
| `lockfile-guard.yml` | Reject unauthorized lockfile changes | PR/manual | Yes when required |
| `migrate-gs-api-d1.yml` | Run reviewed D1 migrations with backup artifacts | Manual | No |
| `pr-triage.yml` | Evaluate the PR ruleset | PR/manual | Advisory/blocking by rule |
| `preview-gs-api.yml` | Validate the preview API Worker with a dry run | PR/manual | No |
| `repo-health.yml` | Run repository health checks | Push/PR/manual | Yes when required |
| `required-merge-checks.yml` | Install, test, build, and dry-run both apps | PR to main | Yes |
| `verify-gs-web-deployment.yml` | Verify the external Cloudflare Workers Build result | Deployment status | External release gate |

## Retired on 2026-08-12

These workflows were disabled in GitHub and removed from the active directory:

- `anthropic-oidc.yml`: unused experimental exchange flow with no working caller.
- `auto-resolve-lockfile-conflicts.yml`: rewrote contributor branches.
- `frogbot-scan-and-fix.yml`: failed continuously without a JFrog platform URL or token.
- `lockfile-maintenance.yml`: could push directly to main or force-update repair branches.
- `notify-chat.yml`: continuously skipped because its destination was not configured.
- `pr-hygiene.yml`: automatically closed conflicted or red PRs after three days.
- `repomaint.yml`: duplicated CI/repo-health and was never run.
- `stale.yml`: generic stale labeling added noise to active handoff issues.
- `summary.yml`: issue summarization had only failed runs and no operational dependency.

Git history is the archive. Restore one only through a new reviewable PR with a
current owner, required secrets, a two-app use case, and a successful test run.
