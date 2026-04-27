# Infra Sync Runbook

Use `.github/workflows/maintenance.yml` to run Cloudflare infrastructure reconciliation separately from app deploy pipelines.

## Trigger model

- **Manual (`workflow_dispatch`):** the only trigger; recommended for urgent reconciliation, post-incident verification, or post-rotation validation.

## When to run manually

Run `Maintenance: Cloudflare Infra Reconcile` manually when:

- You rotate Cloudflare credentials or namespace bindings.
- You changed Cloudflare resources via dashboard/API and need repo-defined state re-applied.
- You need immediate drift correction before the next scheduled run.

## Required GitHub Secrets

Set these repository secrets before enabling the workflow:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_KV_NAMESPACE_API_ID`
- `CLOUDFLARE_KV_NAMESPACE_GATEWAY_ID`

Optional for token rotation without downtime:

- `CLOUDFLARE_BUILD_API_TOKEN` (if set, workflows prefer this token and fall back to `CLOUDFLARE_API_TOKEN`)

Do not store Cloudflare credentials or namespace IDs in tracked workflow files or scripts.

## gs-control token rotation checklist

Use this checklist when Cloudflare Worker Builds reports that the selected build token was deleted/rolled, or when Ops intentionally rotates the Worker Builds credentials for `gs-api`, `gs-gateway`, and `gs-control`.

### 1. Rotate the Worker Builds token in Cloudflare

For each Worker/Pages project involved in the deploy chain:

1. Open **Cloudflare Dashboard** → **Workers & Pages**.
2. Open the project/service (`gs-api`, `gs-gateway`, `gs-control`; include `gs-agent` too if its preview workflow is being retried in the same window).
3. Go to **Settings** → **Builds & deployments** → **Build watch paths / Worker Builds token**.
4. Generate or select the replacement build token.
5. Save the change and verify the project is now pointing at the intended active token.

> Repository policy: all API services and workers should use the `gs-control` build token for Cloudflare Worker Builds so the dashboard state stays aligned across the fleet.

### 2. Update GitHub repository secrets before rerunning workflows

Rotate the GitHub Actions secrets in the same maintenance window so preview and production jobs consume the same credential set:

- Update `CLOUDFLARE_API_TOKEN` if the base deploy token changed.
- Update `CLOUDFLARE_BUILD_API_TOKEN` if you are using the dedicated build-token override path.
- Confirm `CLOUDFLARE_ACCOUNT_ID` is still the correct target account.

#### Workflow-to-secret map

| Workflow | Purpose | Secrets consumed in repo | Rotation note |
| --- | --- | --- | --- |
| `.github/workflows/deploy-gs-api.yml` | `main` → production deploy for `gs-api` | `CLOUDFLARE_BUILD_API_TOKEN` **or** `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Keep the build-token override aligned with preview so both environments rotate together. |
| `.github/workflows/preview-gs-api.yml` | PR preview deploy for `gs-api` | `CLOUDFLARE_BUILD_API_TOKEN` **or** `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Uses the same build-token fallback as production; rotate both together. |
| `.github/workflows/deploy-gs-gateway.yml` | `main` → production deploy for `gs-gateway` | `CLOUDFLARE_BUILD_API_TOKEN` **or** `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Keep the production gateway token aligned with preview because both now use the same fallback chain. |
| `.github/workflows/preview-gs-gateway.yml` | PR preview deploy for `gs-gateway` | `CLOUDFLARE_BUILD_API_TOKEN` **or** `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Prefer updating both token secrets during rotation so fallback behavior is deterministic. |
| `.github/workflows/deploy-gs-control.yml` | `main` → production deploy for `gs-control` | `CLOUDFLARE_BUILD_API_TOKEN` **or** `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Active production deploy; rotate the override token in the same window as the other worker deploys. |
| `.github/workflows/preview-gs-agent.yml` | PR preview deploy for `gs-agent` | `CLOUDFLARE_BUILD_API_TOKEN` **or** `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Include when agent preview retries share the same maintenance window. |
| `.github/workflows/deploy-gs-agent.yml` | `main` → production deploy for `gs-agent` | `CLOUDFLARE_BUILD_API_TOKEN` **or** `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` | Active production deploy; keep it in sync with the preview workflow because both use the same fallback token model. |
| `.github/workflows/maintenance.yml` | manual infra reconciliation after rotation | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GS_KV_NAMESPACE_ID` | Run after secret updates to confirm the repo can still reconcile Cloudflare state. |

### 3. Reconcile preview worker environments and service names in Cloudflare

Before rerunning failed jobs, verify that the preview environment names documented in the repo still exist in Cloudflare and point to the correct services/projects:

- `infra/Cloudflare/gs-api.wrangler.toml` defines the preview worker environment name `gs-api-preview` for `api-preview.goldshore.ai`.
- `infra/Cloudflare/gs-agent.wrangler.toml` defines the preview worker environment name `gs-agent-preview`.
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
4. Record which token secret path was used (`CLOUDFLARE_API_TOKEN` only vs. `CLOUDFLARE_BUILD_API_TOKEN` override) so the next rotation stays consistent.
