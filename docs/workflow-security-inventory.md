# GitHub Actions workflow security inventory

This inventory classifies every workflow in `.github/workflows`. A workflow has one primary
class even when it contains a dry-run check. Production route and Access-policy ownership is
deliberately excluded from deploy workflows: those account mutations use the approval-gated
operator runbook and are verified by the read-only audit.

| Workflow | Classification | Authority / notes |
| --- | --- | --- |
| `admin-merge-cockpit.yml` | Manual repository mutation | SHA-locked salvage branch creation from reviewed conflict decisions. |
| `audit-gs-api-secrets.yml` | Read-only discovery | Compares secret names with the source-controlled contract without reading values. |
| `ci.yml` | CI | Validation and build checks. |
| `cloudflare-audit.yml` | Read-only discovery | Scoped read token; redacted artifact; GET requests only; owns live resource-drift validation so deterministic PR CI does not depend on mutable account state. |
| `cloudflare-operator.yml` | Manual account mutation | Approval-gated human runbook; intentionally executes no API mutation. |
| `deploy-gs-api.yml` | Production deployment | Deploys the unified API Worker; route reassignment is prohibited. |
| `deploy-gs-web.yml` | CI | Builds the web Worker; the workflow explicitly performs no deployment. |
| `enforce-branch-protection.yml` | Manual account mutation | Mutates GitHub repository policy, not Cloudflare. |
| `issue-agent-triage.yml` | CI | GitHub issue metadata automation. |
| `label.yml` | CI | Applies path labels to pull requests. |
| `lockfile-guard.yml` | CI | Lockfile policy check. |
| `migrate-gs-api-d1.yml` | Manual data mutation | Approval-gated D1 migration runner with backup artifacts. |
| `pr-triage.yml` | CI | Evaluates the repository PR ruleset without mutating source. |
| `preview-gs-api.yml` | Preview deployment | Currently a build-only Wrangler dry run. |
| `repo-health.yml` | CI | Repository health checks. |
| `required-merge-checks.yml` | CI | Required builds, tests, and deploy dry runs. |
| `verify-gs-web-deployment.yml` | CI | Verifies Cloudflare Workers Build deployment status. |

## Retired overlapping workflows

`cf-discover.yml` and `infrastructure-guard.yml` were consolidated into
`cloudflare-audit.yml`. `reconcile-dns.yml`, `reconcile-access-github-idp.yml`,
`setup-cf-agent-access.yml`, `setup-preview-dns.yml`, and `manage-cf-tokens.yml` were
removed because they provided independent, overlapping Cloudflare mutation paths. Token
creation, DNS, Worker-route, Access-policy, and identity-provider changes now require the
single `cloudflare-production-operator` environment approval and named-human runbook.
The arbitrary satellite `deploy-dispatch.yml` path was also removed because it bypassed the
two-app deployment boundary and accepted caller-provided install and Wrangler commands.

The broken or redundant `anthropic-oidc.yml`,
`auto-resolve-lockfile-conflicts.yml`, `frogbot-scan-and-fix.yml`,
`lockfile-maintenance.yml`, `notify-chat.yml`, `pr-hygiene.yml`,
`repomaint.yml`, `stale.yml`, and `summary.yml` workflows were disabled and
removed on 2026-08-12. Git history remains the archive. Lockfile repair is now
an intentional local operation followed by a reviewable PR; PRs are not closed
or rewritten automatically.

## Required environments and tokens

- `cloudflare-audit`: configure `CLOUDFLARE_ACCOUNT_ID` and a
  `CLOUDFLARE_AUDIT_TOKEN` limited to the account/zone read permissions used by the audit.
- `cloudflare-production-operator`: require reviewers and prevent self-review. It has no
  Cloudflare secret because changes are intentionally performed by a named human.
- Production deploy environments must require reviewers and contain only the narrowly
  scoped Worker Scripts deployment token needed for their application. It must not grant
  Zone Workers Routes, DNS, Access Apps/Policies, or account-token edit permissions.

Never restore global API-key authentication (`CF_AUTH_EMAIL` / `CF_AUTH_KEY`).
