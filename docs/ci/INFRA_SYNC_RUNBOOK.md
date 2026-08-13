# Infra Sync Runbook

Use `.github/workflows/maintenance.yml` to run Cloudflare infrastructure reconciliation separately from app deploy pipelines.

For incident triage and guardrail verification, inspect and run `.github/workflows/cloudflare-infra-guard.yml` (the canonical replacement for the retired Cloudflare Pages guard workflow path).

For ownership and canonical Cloudflare infrastructure context, cross-reference `policy/REPO_OWNERSHIP.md` and `infra/Cloudflare/README.md`.

## Trigger model

- **Manual (`workflow_dispatch`):** the only trigger; recommended for urgent reconciliation, post-incident verification, or post-rotation validation.

## When to run manually

Run `Maintenance: Cloudflare Infra Reconcile` manually when:

- You rotate Cloudflare credentials or namespace bindings.
- You changed Cloudflare resources via dashboard/API and need repo-defined state re-applied.
- You need immediate drift correction before the next scheduled run.

## Required GitHub Secrets

Set these repository secrets before enabling the workflow:

- `CLOUDFLARE_BUILD_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_KV_NAMESPACE_API_ID`
- `CLOUDFLARE_KV_NAMESPACE_GATEWAY_ID`

Active deploy and reconciliation workflows use `CLOUDFLARE_BUILD_API_TOKEN` as the single Cloudflare deploy token. Some workflow steps may still export runtime environment variable `CLOUDFLARE_API_TOKEN` from `secrets.CLOUDFLARE_BUILD_API_TOKEN` when Wrangler or scripts expect that variable name; do not create or rotate `CLOUDFLARE_API_TOKEN` as a separate deploy credential.

Do not store Cloudflare credentials or namespace IDs in tracked workflow files or scripts.

## gs-control token rotation checklist

Use this checklist when Cloudflare Worker Builds reports that the selected build token was deleted/rolled, or when Ops intentionally rotates the Worker Builds credentials for `gs-api`, `gs-gateway`, and `gs-control`.

### 1. Rotate the Worker Builds token in Cloudflare

For each Worker/Pages project involved in the deploy chain:

1. Open **Cloudflare Dashboard** → **Workers & Pages**.
2. Open the active project/service (`gs-api` or `gs-web`). Historical satellite
   projects, including `gs-agent`, are not deploy targets and must not be
   recreated during credential recovery.
3. Go to **Settings** → **Builds & deployments** → **Build watch paths / Worker Builds token**.
4. Generate or select the replacement build token.
5. Save the change and verify the project is now pointing at the intended active token.

> Repository policy: all API services and workers should use the `gs-control` build token for Cloudflare Worker Builds so the dashboard state stays aligned across the fleet.

### 2. Update GitHub repository secrets before rerunning workflows

Rotate the GitHub Actions secrets in the same maintenance window so preview and production jobs consume the same credential set:

- Update `CLOUDFLARE_BUILD_API_TOKEN` when the active deploy token changes.
- Confirm `CLOUDFLARE_ACCOUNT_ID` is still the correct target account.
- Do not rotate `CLOUDFLARE_API_TOKEN` as a separate deploy token; if a job needs that runtime variable name, map it from `secrets.CLOUDFLARE_BUILD_API_TOKEN`.

#### Workflow-to-secret map

| Workflow | Purpose | Secrets consumed in repo | Rotation note |
| --- | --- | --- | --- |
| `.github/workflows/deploy-gs-api.yml` | `main` → production deploy for `gs-api` | `CLOUDFLARE_BUILD_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Rotate the single build token with preview so both environments stay aligned. |
| `.github/workflows/preview-gs-api.yml` | PR preview deploy for `gs-api` | `CLOUDFLARE_BUILD_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Uses the same single build token as production; rotate both together. |
| `.github/workflows/deploy-gs-gateway.yml` | `main` → production deploy for `gs-gateway` | `CLOUDFLARE_BUILD_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Keep the production gateway token aligned with preview because both use the same build token. |
| `.github/workflows/preview-gs-gateway.yml` | PR preview deploy for `gs-gateway` | `CLOUDFLARE_BUILD_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Update the single build token during rotation so behavior is deterministic. |
| `.github/workflows/deploy-gs-control.yml` | `main` → production deploy for `gs-control` | `CLOUDFLARE_BUILD_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Active production deploy; rotate the single build token in the same window as the other worker deploys. |
| `.github/workflows/maintenance.yml` | manual infra reconciliation after rotation | `CLOUDFLARE_BUILD_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GS_KV_NAMESPACE_ID` | Run after secret updates to confirm the repo can still reconcile Cloudflare state; steps may expose `CLOUDFLARE_API_TOKEN` from the build-token secret for Wrangler/script compatibility. |

### 3. Reconcile preview worker environments and service names in Cloudflare

Before rerunning failed jobs, verify that the preview environment names documented in the repo still exist in Cloudflare and point to the correct services/projects:

- `infra/Cloudflare/gs-api.wrangler.toml` defines the preview worker environment name `gs-api-preview` for `api-preview.goldshore.ai`.
- `gs-agent-preview` is a retired historical name. Do not create it or derive
  dashboard configuration from `infra/Cloudflare/legacy/gs-agent.wrangler.toml`.
- Preview hostnames already referenced elsewhere in the repo include `api-preview.goldshore.ai`, `gw-preview.goldshore.ai`, and `ops-preview.goldshore.ai`.

If the Cloudflare dashboard still uses older service names such as `astro-gs-api`, `astro-gs-gateway`, or `goldshore-control-worker`, reconcile them with the canonical `gs-*` names before retrying preview/prod jobs. This avoids build-token rotation succeeding while the deploy still targets the wrong worker/service.

### 4. Confirm preview DNS/routes for the `*-preview.goldshore.ai` hosts

Check that the expected preview DNS/custom-domain routing exists for the preview hosts referenced in repository config and docs:

- `api-preview.goldshore.ai`
- `gw-preview.goldshore.ai`
- `ops-preview.goldshore.ai`
- `admin-preview.goldshore.ai`
- `preview.goldshore.ai`

If a workflow rerun still fails after token rotation, verify both the Cloudflare custom-domain attachment and the DNS record for the matching `*-preview.goldshore.ai` hostname.

### 5. Rerun the affected GitHub workflows

After Cloudflare and GitHub secrets are updated:

1. Rerun the failed preview jobs first so branch environments recover quickly.
2. Rerun the related production deploy jobs if they were blocked by the same token issue.
3. Manually run `.github/workflows/maintenance.yml` to confirm the new secret set can still reconcile infra state.
4. Record that the `CLOUDFLARE_BUILD_API_TOKEN` path was used so the next rotation stays consistent.
